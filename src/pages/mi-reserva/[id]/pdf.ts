// @ts-nocheck
import type { APIRoute } from "astro";
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from "pdf-lib";
import { ApiError, getBooking, getTour } from "@/lib/api.js";

export const prerender = false;

/**
 * A PDF has no notion of "relative" links, so we need an absolute origin
 * for the buttons. Derived from the incoming request so it's automatically
 * correct in dev, previews, and production (see previous iteration for the
 * x-forwarded-host reasoning).
 */
function resolveSiteUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

/**
 * Palette pulled to roughly match your site's CSS custom properties
 * (--forest-deep, --parchment, --cream, --gold, --ink, --russet, --line).
 * pdf-lib can't read your global.css, so these are close approximations —
 * tweak the RGB values below if you want an exact match to your palette.
 */
const COLOR = {
  forestDeep: rgb(0.106, 0.161, 0.129), // dark green header/footer band
  parchment: rgb(0.973, 0.953, 0.898), // page background
  cream: rgb(1, 0.968, 0.925), // card background
  parchmentAlt: rgb(0.949, 0.914, 0.843), // #f2ead7-ish
  gold: rgb(0.851, 0.608, 0.196), // accent / eyebrow text
  goldSoft: rgb(0.91, 0.725, 0.412),
  ink: rgb(0.094, 0.133, 0.098), // body text
  russet: rgb(0.616, 0.18, 0.129), // secondary accent
  orange: rgb(0.906, 0.475, 0.102), // #E8791A, matches your .first__row
  line: rgb(0.788, 0.741, 0.639),
  faint: rgb(0.53, 0.5, 0.44), // muted, low-contrast text for the tipping note
} as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (value: string) => value?.slice(0, 5) ?? value;

/**
 * pdf-lib has no built-in "add a clickable link" helper, so we build the
 * Link annotation by hand and attach it to the page. `rect` is
 * [x1, y1, x2, y2] in PDF points, measured from the bottom-left of the page.
 */
function addLinkAnnotation(
  page: import("pdf-lib").PDFPage,
  rect: [number, number, number, number],
  url: string
) {
  const doc = page.doc;
  const linkAnnotation = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(url),
      },
    })
  );

  const existingAnnots = page.node.lookup(PDFName.of("Annots"));
  if (existingAnnots) {
    (existingAnnots as any).push(linkAnnotation);
  } else {
    page.node.set(PDFName.of("Annots"), doc.context.obj([linkAnnotation]));
  }
}

/** Draws a filled button with centered text and wires it to a URL. */
function drawButton(
  page: import("pdf-lib").PDFPage,
  font: import("pdf-lib").PDFFont,
  {
    x,
    y,
    width,
    height,
    label,
    url,
    fill = COLOR.orange,
    textColor = COLOR.cream,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    url: string;
    fill?: ReturnType<typeof rgb>;
    textColor?: ReturnType<typeof rgb>;
  }
) {
  page.drawRectangle({ x, y, width, height, color: fill });

  const fontSize = 11;
  const textWidth = font.widthOfTextAtSize(label, fontSize);
  page.drawText(label, {
    x: x + (width - textWidth) / 2,
    y: y + (height - fontSize) / 2 + 2,
    size: fontSize,
    font,
    color: textColor,
  });

  addLinkAnnotation(page, [x, y, x + width, y + height], url);
}

/** Simple greedy word-wrap at a given font/size/width. */
function wrapText(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const GET: APIRoute = async ({ params, request }) => {
  const bookingId = params.id;
  const SITE_URL = resolveSiteUrl(request);

  if (!bookingId) {
    return new Response("Falta el identificador de la reserva.", { status: 400 });
  }

  let booking: any;
  try {
    booking = await getBooking(bookingId);
  } catch (err) {
    const status = err instanceof ApiError && err.status === 404 ? 404 : 502;
    return new Response(
      status === 404
        ? "No hemos encontrado esa reserva."
        : "No hemos podido recuperar los datos de tu reserva.",
      { status }
    );
  }

  // The meeting point lives on the tour, not the booking, so we fetch it
  // the same way tour-detail.astro does. This is best-effort: a booking
  // is still useful without it, so a failed/missing lookup just skips the
  // section instead of failing the whole PDF.
  // NOTE: adjust `booking.tour_id` below if your booking record exposes
  // the tour reference under a different key (e.g. booking.tourId).
  let tour: any = null;
  const tourId = booking.tour_id ?? booking.tourId ?? booking.tour?.id;
  if (tourId) {
    try {
      tour = await getTour(tourId);
    } catch {
      tour = null;
    }
  }
  const hasMeetingPoint = tour?.meeting_point_lat != null && tour?.meeting_point_lng != null;

  const pdfDoc = await PDFDocument.create();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  // Closest StandardFonts stand-in for your italic Fraunces display font.
  // For a pixel-perfect match, embed the real Fraunces .ttf with
  // @pdf-lib/fontkit instead — see note at the bottom of this file.
  const fontDisplay = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const pageWidth = 420;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;

  // ---- Precompute wrapped text blocks so we can size the page up front ----
  const rows: [string, string][] = [
    ["Nombre", booking.customer_name],
    ["Email", booking.customer_email],
    ["Fecha", formatDate(booking.tour_date)],
  ];
  if (booking.departure_time) rows.push(["Hora", formatTime(booking.departure_time)]);
  rows.push(["Adultos", String(booking.quantity)]);
  if (booking.number_of_children > 0) rows.push(["Niños", String(booking.number_of_children)]);
  if (booking.number_of_babies > 0) rows.push(["Bebés", String(booking.number_of_babies)]);
  if (booking.number_of_pets > 0) rows.push(["Mascotas", String(booking.number_of_pets)]);
  rows.push(["Total", "0.00€"]);

  const rowHeight = 24;
  const detailsHeaderHeight = 40; // orange "Ruta" band, like .first__row
  const detailsBoxHeight = detailsHeaderHeight + rowHeight * rows.length + 14;

  const warning =
    "Esta reserva esta condicionada y puede sufrir variaciones o cancelaciones si no se cumple el minimo de personas. Te lo notificaremos por WhatsApp o email. El guía se reserva el derecho de admisión.";
  const warningLines = wrapText(warning, font, 9, contentWidth - 32);
  const warningHeight = warningLines.length * 12 + 24;

  // A second, separate notice about insurance coverage — kept distinct from
  // the quorum/cancellation warning above so each box stays scannable on
  // its own rather than merging two unrelated caveats into one wall of text.
  const insuranceNote =
    "El seguro del tour solo cubre incidentes ocurridos directamente durante el trayecto. No cubre malestares gástricos por alimentos/bebidas (ya que no los proporcionamos) ni incidentes por descuido personal. Las mascotas son bienvenidas reservando su lugar, pero no tienen cobertura de seguro y cualquier gasto o imprevisto corre totalmente por cuenta de sus dueños.";
  const insuranceLines = wrapText(insuranceNote, font, 9, contentWidth - 32);
  const insuranceHeight = insuranceLines.length * 12 + 24;

  // A third box, placed at the very bottom of the ticket content (just
  // above the footer band), covering guide liability insurance and each
  // participant's own responsibility for fitness/health/belongings.
  const safetyTitle = "Seguridad y responsabilidad en el tour";
  const safetyBody =
    "Guío los paseos con total tranquilidad porque cuento con un seguro de responsabilidad civil profesional. No obstante, ten en cuenta que cada participante se une a la caminata bajo su propia responsabilidad en lo referente a su estado físico, salud y pertenencias personales. Te recomiendo venir con calzado cómodo apto para los adoquines de Dublín y avisarme si tienes alguna molestia antes de empezar. El seguro cubre la actividad profesional del guía, pero no lesiones previas, dolencias de casa ni despistes con tus objetos personales. ¡Prevenir es curar!";
  const safetyLines = wrapText(safetyBody, font, 9, contentWidth - 32);
  const safetyTitleHeight = 18; // space reserved for the bold title line
  const safetyHeight = safetyTitleHeight + safetyLines.length * 12 + 24;

  const meetingAddressLines = hasMeetingPoint
    ? wrapText(tour.meeting_point || "Punto de encuentro disponible en el mapa.", font, 10, contentWidth - 32)
    : [];
  const meetingSectionHeight = hasMeetingPoint
    ? 26 /* eyebrow + title */ + meetingAddressLines.length * 13 + 16 /* spacing */ + 34 /* map button */ + 24
    : 0;

  // A quiet, understated note about what a free tour is and how tips can
  // be given. Deliberately small, low-contrast, and unembellished so it
  // reads as a footnote rather than a call to action — present for anyone
  // who actually reads the page, invisible to anyone skimming it.
  const freeTourNote =
    "Un free tour es una visita guiada sin precio fijo: al finalizar, cada persona aporta la propina que considere justa según lo que le haya aportado la experiencia. Si quieres dejar propina, puedes hacerlo en efectivo o mediante tarjeta, Revolut o Bizum.";
  const freeTourNoteLines = wrapText(freeTourNote, fontItalic, 7.5, contentWidth);
  const freeTourNoteHeight = freeTourNoteLines.length * 10.5 + 4;

  const headerBandHeight = 96;
  const footerBandHeight = 70;
  const buttonsHeight = 34 * 2 + 12; // two buttons + gap
  const sectionGap = 22;

  const pageHeight =
    headerBandHeight +
    sectionGap +
    detailsBoxHeight +
    sectionGap +
    meetingSectionHeight +
    (hasMeetingPoint ? sectionGap : 0) +
    warningHeight +
    sectionGap +
    insuranceHeight +
    sectionGap +
    buttonsHeight +
    sectionGap +
    freeTourNoteHeight +
    sectionGap +
    safetyHeight +
    sectionGap +
    footerBandHeight +
    20;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Full-page parchment background
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: COLOR.parchment });

  // ---- Header band (mirrors your dark nav / hero) ----
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerBandHeight,
    width: pageWidth,
    height: headerBandHeight,
    color: COLOR.forestDeep,
  });

  page.drawText("Meriyo Tours (Dublin)", {
    x: marginX,
    y: pageHeight - 30,
    size: 10,
    font: fontBold,
    color: COLOR.gold,
  });
  page.drawText("EXCURSIÓN GRATUITA", {
    x: marginX,
    y: pageHeight - 44,
    size: 7.5,
    font,
    color: COLOR.goldSoft,
  });
  page.drawText("Reserva confirmada", {
    x: marginX,
    y: pageHeight - 76,
    size: 21,
    font: fontDisplay,
    color: COLOR.cream,
  });

  let cursorY = pageHeight - headerBandHeight - sectionGap;

  // ---- Details card ----
  const boxTop = cursorY;
  page.drawRectangle({
    x: marginX,
    y: boxTop - detailsBoxHeight,
    width: contentWidth,
    height: detailsBoxHeight,
    color: COLOR.cream,
    borderColor: COLOR.line,
    borderWidth: 1,
  });

  // Orange "Ruta" header band, matching .first__row on the confirmation page
  page.drawRectangle({
    x: marginX,
    y: boxTop - detailsHeaderHeight,
    width: contentWidth,
    height: detailsHeaderHeight,
    color: COLOR.orange,
  });
  page.drawText("RUTA", {
    x: marginX + 10,
    y: boxTop - detailsHeaderHeight / 2 - 3,
    size: 10,
    font: fontBold,
    color: COLOR.cream,
  });
  const tourNameSize = 12;
  const tourNameWidth = fontBold.widthOfTextAtSize(booking.tour_name, tourNameSize);
  page.drawText(booking.tour_name, {
    x: marginX + contentWidth - 16 - tourNameWidth,
    y: boxTop - detailsHeaderHeight / 2 - 4,
    size: tourNameSize,
    font: fontBold,
    color: COLOR.cream,
  });

  let rowY = boxTop - detailsHeaderHeight - 20;
  for (const [label, value] of rows) {
    page.drawText(label, { x: marginX + 16, y: rowY, size: 10, font, color: COLOR.ink });
    const valueSize = 10;
    const valueWidth = fontBold.widthOfTextAtSize(String(value), valueSize);
    page.drawText(String(value), {
      x: marginX + contentWidth - 16 - valueWidth,
      y: rowY,
      size: valueSize,
      font: fontBold,
      color: COLOR.ink,
    });
    rowY -= rowHeight;
  }

  cursorY = boxTop - detailsBoxHeight - sectionGap;

  // ---- Meeting point ("Punto de encuentro"), mirrors tour-detail.astro ----
  if (hasMeetingPoint) {
    page.drawText("PUNTO DE ENCUENTRO", {
      x: marginX,
      y: cursorY,
      size: 8,
      font: fontBold,
      color: COLOR.gold,
    });
    cursorY -= 20;

    for (const line of meetingAddressLines) {
      page.drawText(line, { x: marginX, y: cursorY, size: 10, font, color: COLOR.ink });
      cursorY -= 13;
    }
    cursorY -= 8;

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${tour.meeting_point_lat},${tour.meeting_point_lng}`;
    drawButton(page, fontBold, {
      x: marginX,
      y: cursorY - 34,
      width: contentWidth,
      height: 34,
      label: "Ver ubicación en el mapa",
      url: mapsUrl,
      fill: COLOR.russet,
      textColor: COLOR.cream,
    });
    cursorY -= 34 + sectionGap;
  }

  // ---- Warning box (quorum / cancellation) ----
  page.drawRectangle({
    x: marginX,
    y: cursorY - warningHeight,
    width: contentWidth,
    height: warningHeight,
    color: COLOR.parchmentAlt,
    borderColor: COLOR.gold,
    borderWidth: 1,
  });

  let warnY = cursorY - 16;
  for (const line of warningLines) {
    page.drawText(line, { x: marginX + 16, y: warnY, size: 9, font, color: COLOR.ink });
    warnY -= 12;
  }

  cursorY = cursorY - warningHeight - sectionGap;

  // ---- Insurance coverage notice ----
  page.drawRectangle({
    x: marginX,
    y: cursorY - insuranceHeight,
    width: contentWidth,
    height: insuranceHeight,
    color: COLOR.parchmentAlt,
    borderColor: COLOR.gold,
    borderWidth: 1,
  });

  let insuranceY = cursorY - 16;
  for (const line of insuranceLines) {
    page.drawText(line, { x: marginX + 16, y: insuranceY, size: 9, font, color: COLOR.ink });
    insuranceY -= 12;
  }

  cursorY = cursorY - insuranceHeight - sectionGap;

  // ---- Clickable buttons -> back to the live site ----
  const bookingUrl = `${SITE_URL}/mi-reserva/${booking.id}`;
  const homeUrl = SITE_URL;

  drawButton(page, fontBold, {
    x: marginX,
    y: cursorY - 34,
    width: contentWidth,
    height: 34,
    label: "Ver / editar mi reserva online",
    url: bookingUrl,
    fill: COLOR.orange,
    textColor: COLOR.cream,
  });

  drawButton(page, fontBold, {
    x: marginX,
    y: cursorY - 78,
    width: contentWidth,
    height: 34,
    label: "Volver al inicio",
    url: homeUrl,
    fill: COLOR.forestDeep,
    textColor: COLOR.cream,
  });

  cursorY -= 78 + sectionGap;

  // ---- Quiet footnote: what a free tour is + tipping methods ----
  // No box, no heading, no accent color — small italic text in a muted
  // tone that blends into the parchment background. It's there for anyone
  // who reads the page closely, not for anyone skimming it.
  let noteY = cursorY;
  for (const line of freeTourNoteLines) {
    page.drawText(line, {
      x: marginX,
      y: noteY,
      size: 7.5,
      font: fontItalic,
      color: COLOR.faint,
    });
    noteY -= 10.5;
  }

  cursorY -= freeTourNoteHeight + sectionGap;

  // ---- Safety & liability notice (guide insurance + participant's own
  // responsibility for fitness/health/belongings) — the last content box
  // before the footer, so it's the final thing read on the ticket. ----
  page.drawRectangle({
    x: marginX,
    y: cursorY - safetyHeight,
    width: contentWidth,
    height: safetyHeight,
    color: COLOR.parchmentAlt,
    borderColor: COLOR.gold,
    borderWidth: 1,
  });

  page.drawText(safetyTitle, {
    x: marginX + 16,
    y: cursorY - 16,
    size: 9.5,
    font: fontBold,
    color: COLOR.ink,
  });

  let safetyY = cursorY - 16 - safetyTitleHeight;
  for (const line of safetyLines) {
    page.drawText(line, { x: marginX + 16, y: safetyY, size: 9, font, color: COLOR.ink });
    safetyY -= 12;
  }

  cursorY = cursorY - safetyHeight - sectionGap;

  // ---- Footer band (mirrors .site-footer) ----
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: footerBandHeight,
    color: COLOR.forestDeep,
  });
  page.drawText("Meriyo Tours (Dublin)", {
    x: marginX,
    y: footerBandHeight - 26,
    size: 11,
    font: fontDisplay,
    color: COLOR.cream,
  });
  const copyright = `© ${new Date().getFullYear()} Meriyo Tours (Dublin)`;
  page.drawText(copyright, {
    x: marginX,
    y: footerBandHeight - 44,
    size: 8,
    font,
    color: COLOR.goldSoft,
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reserva-${booking.id}.pdf"`,
    },
  });
};

/**
 * To get an exact match with Fraunces/Work Sans instead of the Helvetica
 * stand-ins above:
 *   npm install @pdf-lib/fontkit
 *   import fontkit from "@pdf-lib/fontkit";
 *   pdfDoc.registerFontkit(fontkit);
 *   const fraunces = await pdfDoc.embedFont(fs.readFileSync("path/to/Fraunces-Italic.ttf"));
 * StandardFonts (Helvetica/Times/Courier) are the only fonts pdf-lib can
 * embed without a font file, which is why the body/display text above uses
 * Helvetica variants as the closest built-in approximation.
 */
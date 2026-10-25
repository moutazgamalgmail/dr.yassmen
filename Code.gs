/**
 * يستقبل الحجز من الموقع ويسجله في Google Calendar الخاص بصاحبة العيادة
 * ويبعتلها إيميل بالتفاصيل.
 */
const DURATION_MIN = 30;                 // مدة الكشف بالدقائق
const CALENDAR_ID = "primary";           // أو إيميل كاليندر معين
const NOTIFY_EMAIL = "";                 // اتركيه فاضي لو مش عايزة إيميل

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const [y, m, day] = d.date.split("-").map(Number);
    const [hh, mm] = d.time.split(":").map(Number);
    const start = new Date(y, m - 1, day, hh, mm);   // بتوقيت السكربت
    const end = new Date(start.getTime() + DURATION_MIN * 60000);

    const cal = CalendarApp.getCalendarById(CALENDAR_ID) || CalendarApp.getDefaultCalendar();
    const clash = cal.getEvents(start, end).length > 0;

    const ev = cal.createEvent(
      (clash ? "⚠ تعارض - " : "") + d.service + " - " + d.name,
      start, end,
      { description: "الاسم: " + d.name + "\nالموبايل: " + d.phone + "\nالخدمة: " + d.service + "\nمصدر الحجز: الموقع" }
    );
    ev.addPopupReminder(60);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, "حجز جديد: " + d.name,
        d.service + "\n" + d.date + " " + d.time + "\n" + d.phone + (clash ? "\n\nتنبيه: فيه ميعاد تاني في نفس الوقت" : ""));
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true, clash }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

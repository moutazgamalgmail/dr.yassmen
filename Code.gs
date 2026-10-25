/** Deploy as an Apps Script Web app; set the project timezone to Africa/Cairo. */
const DURATION_MIN = 30;
const CALENDAR_ID = 'primary';
const NOTIFY_EMAIL = '';
const SERVICES = ['جلسة استشارة أولى', 'جلسة علاج نفسي', 'جلسة إرشاد أطفال وشباب'];
const SLOTS = ['16:00', '17:00', '18:00', '19:00', '20:00'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index').setTitle('ياسمين محمد سعيد | حجز موعد');
}

function doPost(e) {
  let result;
  try { result = bookAppointment(JSON.parse(e.postData.contents)); }
  catch (_) { result = {ok: false, code: 'INVALID', error: 'بيانات الحجز غير صالحة.'}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function bookAppointment(d) {
  const invalid = {ok: false, code: 'INVALID', error: 'راجع الاسم والموبايل والخدمة والميعاد.'};
  if (!d || typeof d.name !== 'string' || typeof d.phone !== 'string' ||
      typeof d.date !== 'string' || typeof d.time !== 'string') return invalid;
  const name = d.name.trim(), phone = d.phone.trim();
  if (name.length < 2 || name.length > 100 || /[\r\n]/.test(name) ||
      !/^\+?\d{10,15}$/.test(phone) || !SERVICES.includes(d.service) ||
      !SLOTS.includes(d.time) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return invalid;
  const zone = 'Africa/Cairo';
  let start;
  try {
    start = Utilities.parseDate(d.date + ' ' + d.time, zone, 'yyyy-MM-dd HH:mm');
    if (Utilities.formatDate(start, zone, 'yyyy-MM-dd HH:mm') !== d.date + ' ' + d.time) return invalid;
  } catch (_) { return invalid; }
  const now = new Date();
  const today = Utilities.formatDate(now, zone, 'yyyy-MM-dd');
  const limit = Utilities.formatDate(new Date(now.getTime() + 60 * 86400000), zone, 'yyyy-MM-dd');
  const weekday = new Date(d.date + 'T12:00:00Z').getUTCDay();
  if (d.date < today || d.date > limit || weekday === 5 || start.getTime() <= now.getTime() + 30 * 60000) return invalid;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return {ok: false, code: 'BUSY', error: 'فيه طلبات كتير دلوقتي، حاول كمان شوية.'};
  try {
    const cal = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!cal) throw new Error('Calendar unavailable');
    const end = new Date(start.getTime() + DURATION_MIN * 60000);
    if (cal.getEvents(start, end).length) return {ok: false, code: 'CONFLICT', error: 'الميعاد اتحجز بالفعل، اختار ميعاد تاني.'};
    cal.createEvent(d.service + ' - ' + name, start, end, {
      description: 'الاسم: ' + name + '\nالموبايل: ' + phone + '\nالخدمة: ' + d.service + '\nمصدر الحجز: الموقع'
    });
    // Notification failure must not turn a saved booking into a retry.
    if (NOTIFY_EMAIL) {
      try { MailApp.sendEmail(NOTIFY_EMAIL, 'حجز جديد', d.service + '\n' + d.date + ' ' + d.time); }
      catch (_) { console.warn('Booking saved; notification failed.'); }
    }
    return {ok: true};
  } catch (_) {
    return {ok: false, code: 'SERVER', error: 'تعذر تأكيد الحجز. تواصل مع العيادة قبل إعادة المحاولة.'};
  } finally { lock.releaseLock(); }
}

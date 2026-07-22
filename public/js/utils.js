export function pad(number) {
    return String(number).padStart(2, '0');
}

export function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

export function formatDate(date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
}

export function getTodayStr() {
    return formatDate(new Date());
}

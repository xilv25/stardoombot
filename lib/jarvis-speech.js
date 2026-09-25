import { sym } from './global-symbol.js';

export const jarvisSpeeches = {
    english: [
        "Initializing primary mainframe protocols and securing core network vectors.",
        "Boot sequence successfully executed. Calibrating system matrices.",
        "Establishment of secure uplink complete. All diagnostic parameters nominal.",
        "Activating tactical subroutines and neural interfaces. Systems are online."
    ],
    indonesian: [
        "Memuat protokol utama sistem dan mengamankan jaringan inti.",
        "Urutan booting berhasil dijalankan. Mengkalibrasi matriks sistem.",
        "Koneksi jaringan aman telah tersambung sepenuhnya. Semua parameter stabil.",
        "Mengaktifkan subrutin taktis dan antarmuka. Seluruh sistem siap beroperasi."
    ],
    getReport: (pluginCount, heapUsedMB, uptimeSec) => {
        return `${sym.arrowCurve} ${sym.swoosh} *SYSTEM STATUS REPORT* ${sym.sparkle}\n\n` +
               `• Active Modules: ${pluginCount} plugins loaded\n` +
               `• Memory Allocation: ${heapUsedMB} MB\n` +
               `• System Uptime: ${uptimeSec} seconds\n` +
               `• Operational Status: Fully functional and secure.`;
    }
};

export function getRandomSpeech(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

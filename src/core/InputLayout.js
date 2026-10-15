// iPadOS can identify as a desktop Mac, including in a wide landscape view.
// Desktop touchscreens otherwise keep the desktop layout at desktop widths.
export function isMobileDevice(device = globalThis.navigator) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(device?.userAgent || '') ||
        (/Macintosh|MacIntel/i.test(`${device?.userAgent || ''} ${device?.platform || ''}`) && device?.maxTouchPoints > 1);
}

export function useMobileLayout(width = globalThis.innerWidth, device = globalThis.navigator) {
    return isMobileDevice(device) || width <= 800;
}

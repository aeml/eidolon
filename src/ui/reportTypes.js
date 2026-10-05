// Literal categories shared by submission, owner lookup and account support.
// A request is a private case for review, not authority to export or delete data.
export const PRIVACY_REPORT_TYPES = new Set(['Account Data Export', 'Account Removal Request']);
export const ACCOUNT_SUPPORT_REPORT_TYPES = new Set(['Moderation Appeal', ...PRIVACY_REPORT_TYPES]);
export const REPORT_TYPES = new Set(['Bug Report', 'Player Report', 'Feature Request', ...ACCOUNT_SUPPORT_REPORT_TYPES]);

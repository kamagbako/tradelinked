// Shared by the register form (live feedback) and the signUp server action (enforcement).

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export function passwordChecks(password: string) {
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: "letter", label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { id: "number", label: "Contains a number", met: /\d/.test(password) },
  ];
}

export function isStrongPassword(password: string) {
  return passwordChecks(password).every((check) => check.met);
}

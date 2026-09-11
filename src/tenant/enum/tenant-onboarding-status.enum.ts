export enum TenantOnboardingStatus {
  PENDING = 'PENDING',
  // Self-serve only — a signup held for a platform admin to review, rather
  // than auto-enqueueing provisioning. See
  // PlatformSettingKey.SELF_SERVE_REQUIRES_APPROVAL. Never reached by
  // platform-admin-initiated tenant creation, which stays instant.
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
}

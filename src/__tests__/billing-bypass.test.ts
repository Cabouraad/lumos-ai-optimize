import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the grant-starter-bypass function logic
const mockCheckBypassEligibility = (
  userEmail: string,
  bypassEnabled: string | undefined,
  allowedEmails: string | undefined,
  expiresAt: string | undefined
): { eligible: boolean; reason?: string } => {
  if (bypassEnabled !== "true") {
    return { eligible: false, reason: "Billing bypass is disabled" };
  }

  const emailList = allowedEmails?.split(",").map(email => email.trim().toLowerCase()) || [];
  if (!emailList.includes(userEmail.toLowerCase())) {
    return { eligible: false, reason: "Email not in bypass list" };
  }

  if (expiresAt && new Date() > new Date(expiresAt)) {
    return { eligible: false, reason: "Bypass period has expired" };
  }

  return { eligible: true };
};

const mockUpsertSubscriber = (
  userEmail: string,
  userId: string,
  existingSubscriber: any = null
) => {
  // Skip if existing paid customer
  if (existingSubscriber?.subscribed && existingSubscriber?.subscription_tier !== 'starter') {
    return { skipped: true, reason: 'Existing paid customer' };
  }

  const trialStart = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  return {
    email: userEmail,
    user_id: userId,
    stripe_customer_id: "manual_bypass",
    subscribed: true,
    subscription_tier: "starter",
    subscription_end: trialEnd.toISOString(),
    trial_started_at: trialStart.toISOString(),
    trial_expires_at: trialEnd.toISOString(),
    payment_collected: true,
    metadata: { source: 'bypass' }
  };
};

describe('Billing Bypass Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert subscribers row when bypass enabled and email matches', () => {
    // Arrange
    const userEmail = 'test@allowlisted.com';
    const userId = 'user-123';
    const bypassEnabled = 'true';
    const allowedEmails = 'test@allowlisted.com,admin@test.com';
    const expiresAt = undefined;

    // Act
    const eligibility = mockCheckBypassEligibility(userEmail, bypassEnabled, allowedEmails, expiresAt);
    
    expect(eligibility.eligible).toBe(true);

    const result = mockUpsertSubscriber(userEmail, userId);

    // Assert
    expect(result).toEqual(expect.objectContaining({
      email: userEmail,
      user_id: userId,
      subscription_tier: 'starter',
      payment_collected: true,
      metadata: { source: 'bypass' }
    }));
  });

  it('should not upsert when bypass disabled', () => {
    // Arrange
    const userEmail = 'test@allowlisted.com';
    const bypassEnabled = 'false';
    const allowedEmails = 'test@allowlisted.com';
    const expiresAt = undefined;

    // Act
    const eligibility = mockCheckBypassEligibility(userEmail, bypassEnabled, allowedEmails, expiresAt);

    // Assert
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toBe('Billing bypass is disabled');
  });

  it('should not upsert for non-allowlisted email', () => {
    // Arrange
    const userEmail = 'unauthorized@notallowed.com';
    const bypassEnabled = 'true';
    const allowedEmails = 'test@allowlisted.com,admin@test.com';
    const expiresAt = undefined;

    // Act
    const eligibility = mockCheckBypassEligibility(userEmail, bypassEnabled, allowedEmails, expiresAt);

    // Assert
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toBe('Email not in bypass list');
  });

  it('should skip bypass for existing paid customer', () => {
    // Arrange
    const userEmail = 'test@allowlisted.com';
    const userId = 'user-123';
    const existingPaidSubscriber = {
      subscribed: true,
      subscription_tier: 'pro',
      payment_collected: true
    };

    // Act
    const result = mockUpsertSubscriber(userEmail, userId, existingPaidSubscriber);

    // Assert
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('Existing paid customer');
  });

  it('should handle expired bypass period', () => {
    // Arrange
    const userEmail = 'test@allowlisted.com';
    const bypassEnabled = 'true';
    const allowedEmails = 'test@allowlisted.com';
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const expiresAt = pastDate.toISOString();

    // Act
    const eligibility = mockCheckBypassEligibility(userEmail, bypassEnabled, allowedEmails, expiresAt);

    // Assert
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toBe('Bypass period has expired');
  });

  it('should allow upsert for existing starter customer', () => {
    // Arrange
    const userEmail = 'test@allowlisted.com';
    const userId = 'user-123';
    const existingStarterSubscriber = {
      subscribed: true,
      subscription_tier: 'starter',
      payment_collected: false
    };

    // Act
    const result = mockUpsertSubscriber(userEmail, userId, existingStarterSubscriber);

    // Assert
    expect(result.skipped).toBeFalsy();
    expect(result).toEqual(expect.objectContaining({
      subscription_tier: 'starter',
      payment_collected: true,
      metadata: { source: 'bypass' }
    }));
  });
});
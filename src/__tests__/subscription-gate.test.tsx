import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@supabase/supabase-js';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockUseAuth = vi.mocked(useAuth);

// Mock router navigate
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/test' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  };
});

describe('SubscriptionGate', () => {
  const createMockUser = (overrides = {}): User => ({
    id: 'user1',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  });

  const TestComponent = () => <div>Protected Content</div>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/test';
  });

  describe('Access Control Matrix', () => {
    it('should allow access when subscribed=true', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: { organizations: { id: 'org1' } },
        subscriptionData: {
          subscribed: true,
          subscription_tier: 'pro',
          subscription_end: null,
          trial_expires_at: null,
          payment_collected: false, // doesn't matter when subscribed=true
          requires_subscription: true
        },
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Protected Content')).toBeInTheDocument();
    });

    it('should deny access when trial active but payment_collected=false', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: { organizations: { id: 'org1' } },
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          subscription_end: null,
          trial_expires_at: futureDate.toISOString(),
          payment_collected: false, // Key: no payment collected
          requires_subscription: true
        },
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText, queryByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Subscription Required')).toBeInTheDocument();
      expect(getByText('Access to Llumos requires an active subscription. Choose a plan to continue.')).toBeInTheDocument();
      expect(queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should allow access when trial active and payment_collected=true', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: { organizations: { id: 'org1' } },
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          subscription_end: null,
          trial_expires_at: futureDate.toISOString(),
          payment_collected: true, // Key: payment collected
          requires_subscription: true
        },
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Protected Content')).toBeInTheDocument();
    });

    it('should deny access when trial expired even with payment_collected=true', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2); // 2 days ago

      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: { organizations: { id: 'org1' } },
        subscriptionData: {
          subscribed: false,
          subscription_tier: 'starter',
          subscription_end: null,
          trial_expires_at: pastDate.toISOString(),
          payment_collected: true, // Doesn't matter if trial expired
          requires_subscription: true
        },
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText, queryByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Subscription Required')).toBeInTheDocument();
      expect(queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should deny access when no subscription and no trial', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: { organizations: { id: 'org1' } },
        subscriptionData: {
          subscribed: false,
          subscription_tier: null,
          subscription_end: null,
          trial_expires_at: null,
          payment_collected: false,
          requires_subscription: true
        },
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText, queryByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Subscription Required')).toBeInTheDocument();
      expect(queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Auth States', () => {
    it('should show loading state when loading=true', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        orgData: null,
        subscriptionData: null,
        loading: true,
        subscriptionLoading: false,
        ready: false,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Loading...')).toBeInTheDocument();
    });

    it('should redirect to auth when user not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        orgData: null,
        subscriptionData: null,
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { queryByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      // Component should redirect, so content shouldn't be visible
      expect(queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should redirect to onboarding when no org data', () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: null,
        subscriptionData: null,
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { queryByText } = render(
        <MemoryRouter>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      // Component should redirect, so content shouldn't be visible
      expect(queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Pricing Page Access', () => {
    it('should allow access to pricing page even without subscription', () => {
      mockLocation.pathname = '/pricing'; // Set pricing path
      
      mockUseAuth.mockReturnValue({
        user: createMockUser(),
        session: { user: createMockUser() } as any,
        orgData: { organizations: { id: 'org1' } },
        subscriptionData: {
          subscribed: false,
          subscription_tier: null,
          subscription_end: null,
          trial_expires_at: null,
          payment_collected: false,
          requires_subscription: true
        },
        loading: false,
        subscriptionLoading: false,
        ready: true,
        checkSubscription: vi.fn(),
        signOut: vi.fn()
      });

      const { getByText } = render(
        <MemoryRouter initialEntries={['/pricing']}>
          <SubscriptionGate>
            <TestComponent />
          </SubscriptionGate>
        </MemoryRouter>
      );

      expect(getByText('Protected Content')).toBeInTheDocument();
    });
  });
});
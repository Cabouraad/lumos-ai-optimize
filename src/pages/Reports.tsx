import { WeeklyReports } from '@/components/WeeklyReports';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { Navigate } from 'react-router-dom';

const Reports = () => {
  // Redirect if feature is disabled
  if (!isFeatureEnabled('FEATURE_WEEKLY_REPORT')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <WeeklyReports />
    </div>
  );
};

export default Reports;
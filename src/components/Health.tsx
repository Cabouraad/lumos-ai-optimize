import React from 'react';

const Health: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">OK</h1>
        <p className="text-muted-foreground">Service is running</p>
        <p className="text-xs text-muted-foreground mt-2">v1.0.0</p>
      </div>
    </div>
  );
};

export default Health;
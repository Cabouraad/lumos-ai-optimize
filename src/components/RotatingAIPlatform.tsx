import { useState, useEffect } from 'react';

const AI_PLATFORMS = [
  'ChatGPT',
  'Google AI Overviews',
  'Gemini',
  'Perplexity'
];

export function RotatingAIPlatform() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % AI_PLATFORMS.length);
    }, 2500); // Change every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block transition-all duration-500 ease-in-out animate-fade-in">
      {AI_PLATFORMS[currentIndex]}
    </span>
  );
}

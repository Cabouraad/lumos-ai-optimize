import { useState, useEffect } from 'react';

const AI_PLATFORMS = [
  'ChatGPT',
  'Google AI Overviews',
  'Gemini',
  'Perplexity'
];

export function RotatingAIPlatform() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);
      
      // Wait for fade out, then change text and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % AI_PLATFORMS.length);
        setIsVisible(true);
      }, 300);
    }, 3500); // Change every 3.5 seconds

    return () => clearInterval(interval);
  }, []);

  // Fixed width to prevent CLS (based on longest text "Google AI Overviews")
  return (
    <span 
      className={`inline-block text-primary transition-all duration-300 ease-in-out min-w-[200px] md:min-w-[300px] lg:min-w-[380px] text-left ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-2'
      }`}
    >
      {AI_PLATFORMS[currentIndex]}
    </span>
  );
}

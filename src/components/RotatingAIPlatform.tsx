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
    }, 2500); // Change every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <span 
      className={`inline-block text-primary transition-all duration-300 ease-in-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-2'
      }`}
    >
      {AI_PLATFORMS[currentIndex]}
    </span>
  );
}

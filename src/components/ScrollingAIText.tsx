import { useEffect, useState } from 'react';

const AI_PLATFORMS = ['ChatGPT', 'Gemini', 'Perplexity', 'Google AI Overviews'];

export function ScrollingAIText() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % AI_PLATFORMS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block relative text-primary overflow-hidden text-center w-full leading-none">
      <span className="inline-block relative w-full leading-none">
        {AI_PLATFORMS.map((platform, index) => (
          <span
            key={platform}
            className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-700 ease-in-out leading-none ${
              index === currentIndex 
                ? 'opacity-100 translate-y-0' 
                : index < currentIndex
                ? 'opacity-0 -translate-y-full'
                : 'opacity-0 translate-y-full'
            }`}
          >
            {platform}
          </span>
        ))}
      </span>
    </span>
  );
}

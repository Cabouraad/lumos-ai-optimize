import { useEffect, useState } from 'react';

const AI_PLATFORMS = ['ChatGPT', 'Gemini', 'Perplexity', 'Google AI Overviews'];

export function ScrollingAIText() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % AI_PLATFORMS.length);
    }, 2500); // Change every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block relative text-primary overflow-hidden align-middle">
      <span className="inline-block min-w-[280px] md:min-w-[380px] lg:min-w-[480px] text-left">
        {AI_PLATFORMS.map((platform, index) => (
          <span
            key={platform}
            className={`inline-block transition-all duration-700 ease-in-out ${
              index === currentIndex 
                ? 'opacity-100 translate-y-0' 
                : index < currentIndex
                ? 'opacity-0 -translate-y-full absolute'
                : 'opacity-0 translate-y-full absolute'
            }`}
            style={{
              position: index === currentIndex ? 'relative' : 'absolute',
              left: 0,
              top: 0,
            }}
          >
            {platform}
          </span>
        ))}
      </span>
    </span>
  );
}

import React from 'react';

interface MobileControlsProps {
  onDirectionPress: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function MobileControls({ onDirectionPress }: MobileControlsProps) {
  const buttonStyle = "w-16 h-16 bg-[#836EF9] hover:bg-[#7059E8] active:bg-[#5A47D7] text-white rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg transition-colors duration-150 select-none";

  const handleTouchStart = (direction: 'up' | 'down' | 'left' | 'right') => {
    onDirectionPress(direction);
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex flex-col items-center space-y-2">
        {/* Up button */}
        <button
          className={buttonStyle}
          onTouchStart={() => handleTouchStart('up')}
          onMouseDown={() => handleTouchStart('up')}
          aria-label="Move up"
        >
          ↑
        </button>
        
        {/* Left, Down, Right buttons */}
        <div className="flex space-x-2">
          <button
            className={buttonStyle}
            onTouchStart={() => handleTouchStart('left')}
            onMouseDown={() => handleTouchStart('left')}
            aria-label="Move left"
          >
            ←
          </button>
          
          <button
            className={buttonStyle}
            onTouchStart={() => handleTouchStart('down')}
            onMouseDown={() => handleTouchStart('down')}
            aria-label="Move down"
          >
            ↓
          </button>
          
          <button
            className={buttonStyle}
            onTouchStart={() => handleTouchStart('right')}
            onMouseDown={() => handleTouchStart('right')}
            aria-label="Move right"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}


import React, { useState, useEffect, useCallback } from 'react';

const PacmonGame: React.FC = () => {
  const GRID_SIZE = 20;
  const CELL_SIZE = 20;

  // Game state
  const [pacmonPos, setPacmonPos] = useState({ x: 1, y: 1 });
  const [ghosts, setGhosts] = useState([
    { x: 18, y: 1, color: 'red' },
    { x: 18, y: 18, color: 'pink' },
    { x: 1, y: 18, color: 'cyan' },
  ]);
  const [dots, setDots] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [direction, setDirection] = useState({ x: 0, y: 0 });

  // Initialize dots
  useEffect(() => {
    const initialDots = new Set<string>();
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        // Skip walls and initial positions
        if (!isWall(x, y) && !(x === 1 && y === 1)) {
          initialDots.add(`${x},${y}`);
        }
      }
    }
    setDots(initialDots);
  }, []);

  // Simple wall detection (border walls)
  const isWall = (x: number, y: number): boolean => {
    return x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1;
  };

  // Check if position is valid (not a wall)
  const isValidPosition = (x: number, y: number): boolean => {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && !isWall(x, y);
  };

  // Move Pacmon
  const movePacmon = useCallback(() => {
    if (gameOver || (direction.x === 0 && direction.y === 0)) return;

    setPacmonPos(prev => {
      const newX = prev.x + direction.x;
      const newY = prev.y + direction.y;

      if (isValidPosition(newX, newY)) {
        return { x: newX, y: newY };
      }
      return prev;
    });
  }, [direction, gameOver]);

  // Move ghosts randomly
  const moveGhosts = useCallback(() => {
    if (gameOver) return;

    setGhosts(prev => prev.map(ghost => {
      const directions = [
        { x: 0, y: -1 }, // up
        { x: 0, y: 1 },  // down
        { x: -1, y: 0 }, // left
        { x: 1, y: 0 }   // right
      ];

      const validMoves = directions.filter(dir => 
        isValidPosition(ghost.x + dir.x, ghost.y + dir.y)
      );

      if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        return {
          ...ghost,
          x: ghost.x + randomMove.x,
          y: ghost.y + randomMove.y
        };
      }

      return ghost;
    }));
  }, [gameOver]);

  // Game loop
  useEffect(() => {
    const gameInterval = setInterval(() => {
      movePacmon();
      moveGhosts();
    }, 200);

    return () => clearInterval(gameInterval);
  }, [movePacmon, moveGhosts]);

  // Check for collisions and dot collection
  useEffect(() => {
    // Check dot collection
    const dotKey = `${pacmonPos.x},${pacmonPos.y}`;
    if (dots.has(dotKey)) {
      setDots(prev => {
        const newDots = new Set(prev);
        newDots.delete(dotKey);
        return newDots;
      });
      setScore(prev => prev + 10);
    }

    // Check ghost collisions
    const collision = ghosts.some(ghost => 
      ghost.x === pacmonPos.x && ghost.y === pacmonPos.y
    );

    if (collision) {
      setGameOver(true);
    }

    // Check win condition
    if (dots.size === 0) {
      setGameOver(true);
    }
  }, [pacmonPos, ghosts, dots]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
          setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
          setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
          setDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameOver]);

  // Restart game
  const restartGame = () => {
    setPacmonPos({ x: 1, y: 1 });
    setGhosts([
      { x: 18, y: 1, color: 'red' },
      { x: 18, y: 18, color: 'pink' },
      { x: 1, y: 18, color: 'cyan' },
    ]);
    setScore(0);
    setGameOver(false);
    setDirection({ x: 0, y: 0 });

    // Reinitialize dots
    const initialDots = new Set<string>();
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!isWall(x, y) && !(x === 1 && y === 1)) {
          initialDots.add(`${x},${y}`);
        }
      }
    }
    setDots(initialDots);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#FFD700', marginBottom: '10px' }}>Pacmon Game</h1>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        width: `${GRID_SIZE * CELL_SIZE}px`,
        marginBottom: '10px'
      }}>
        <div style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold' }}>
          Score: {score}
        </div>
        <div style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold' }}>
          Dots: {dots.size}
        </div>
      </div>

      <div style={{
        position: 'relative',
        width: `${GRID_SIZE * CELL_SIZE}px`,
        height: `${GRID_SIZE * CELL_SIZE}px`,
        backgroundColor: '#000',
        border: '2px solid #0000FF'
      }}>
        {/* Render dots */}
        {Array.from(dots).map(dotKey => {
          const [x, y] = dotKey.split(',').map(Number);
          return (
            <div
              key={dotKey}
              style={{
                position: 'absolute',
                left: `${x * CELL_SIZE + CELL_SIZE/2 - 2}px`,
                top: `${y * CELL_SIZE + CELL_SIZE/2 - 2}px`,
                width: '4px',
                height: '4px',
                backgroundColor: '#FFD700',
                borderRadius: '50%'
              }}
            />
          );
        })}

        {/* Render walls */}
        {Array.from({ length: GRID_SIZE }, (_, x) =>
          Array.from({ length: GRID_SIZE }, (_, y) => {
            if (isWall(x, y)) {
              return (
                <div
                  key={`wall-${x}-${y}`}
                  style={{
                    position: 'absolute',
                    left: `${x * CELL_SIZE}px`,
                    top: `${y * CELL_SIZE}px`,
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    backgroundColor: '#0000FF'
                  }}
                />
              );
            }
            return null;
          })
        )}

        {/* Render Pacmon */}
        <div
          style={{
            position: 'absolute',
            left: `${pacmonPos.x * CELL_SIZE}px`,
            top: `${pacmonPos.y * CELL_SIZE}px`,
            width: `${CELL_SIZE}px`,
            height: `${CELL_SIZE}px`,
            backgroundColor: '#FFFF00',
            borderRadius: '50%',
            zIndex: 10
          }}
        />

        {/* Render ghosts */}
        {ghosts.map((ghost, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${ghost.x * CELL_SIZE}px`,
              top: `${ghost.y * CELL_SIZE}px`,
              width: `${CELL_SIZE}px`,
              height: `${CELL_SIZE}px`,
              backgroundColor: ghost.color,
              borderRadius: '50% 50% 0 0',
              zIndex: 5
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <div style={{ color: '#FFD700', marginBottom: '10px' }}>
          Use arrow keys or WASD to move
        </div>

        {gameOver && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ 
              color: dots.size === 0 ? '#00FF00' : '#FF0000', 
              fontSize: '24px', 
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              {dots.size === 0 ? 'YOU WIN!' : 'GAME OVER!'}
            </div>
            <button
              onClick={restartGame}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#FFD700',
                color: '#000',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PacmonGame;
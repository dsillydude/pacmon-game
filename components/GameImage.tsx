import React from 'react';

interface GameImageProps {
  state: {
    maze: {
      grid: number[][];
      size: number;
    };
    player: {
      x: number;
      y: number;
    };
    ghosts: {
      x: number;
      y: number;
      direction: { x: number; y: number };
    }[];
    level: number;
    score: number;
    lives: number;
    gameStatus: 'playing' | 'level-complete' | 'game-over';
    powerMode: boolean;
  };
}

const GameImage: React.FC<GameImageProps> = ({ state }) => {
  const cellSize = 20;
  const mazeSize = state.maze.size * cellSize;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: 'black',
      color: 'white',
      fontFamily: 'monospace',
      padding: '16px'
    }}>
      {/* Game Info Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>Level: {state.level}</div>
        <div>Score: {state.score}</div>
        <div>Lives: {'❤️'.repeat(state.lives)}</div>
      </div>
      
      {/* Maze Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {/* Maze Grid */}
        <div style={{
          position: 'relative',
          width: mazeSize,
          height: mazeSize,
          backgroundColor: 'black'
        }}>
          {/* Maze Walls and Dots */}
          {state.maze.grid.map((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                style={{
                  position: 'absolute',
                  left: x * cellSize,
                  top: y * cellSize,
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell === 1 ? '#1A237E' : 'black',
                  ...(cell === 1 && { borderRadius: '4px' })
                }}
              >
                {/* Dots */}
                {cell === 2 && (
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '4px',
                    height: '4px',
                    backgroundColor: 'white',
                    borderRadius: '50%'
                  }} />
                )}
                {/* Power Pellets */}
                {cell === 3 && (
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '8px',
                    height: '8px',
                    backgroundColor: 'white',
                    borderRadius: '50%'
                  }} />
                )}
              </div>
            ))
          )}

          {/* Player */}
          <div
            style={{
              position: 'absolute',
              left: state.player.x * cellSize,
              top: state.player.y * cellSize,
              width: cellSize,
              height: cellSize,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <div style={{
              width: cellSize * 0.7,
              height: cellSize * 0.7,
              backgroundColor: 'yellow',
              borderRadius: '50%'
            }} />
          </div>

          {/* Ghosts */}
          {state.ghosts.map((ghost, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: ghost.x * cellSize,
                top: ghost.y * cellSize,
                width: cellSize,
                height: cellSize,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <div style={{
                width: cellSize * 0.7,
                height: cellSize * 0.7,
                backgroundColor: state.powerMode ? 'blue' : 
                  ['red', 'pink', 'cyan', 'orange'][index % 4],
                borderRadius: '50% 50% 0 0'
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Game Status Overlays */}
      {state.gameStatus === 'level-complete' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Level Complete!</div>
          <div>Score: {state.score}</div>
        </div>
      )}

      {state.gameStatus === 'game-over' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Game Over</div>
          <div>Final Score: {state.score}</div>
        </div>
      )}
    </div>
  );
};

export default GameImage;
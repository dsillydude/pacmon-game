export default function GameImage({ state }) {
  const cellSize = 30;
  const offsetX = 20;
  const offsetY = 50;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: 'black',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      {/* Game Info */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '20px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '16px',
        display: 'flex',
        gap: '20px'
      }}>
        <div>Level: {state.level}</div>
        <div>Score: {state.score}</div>
        <div>Lives: {'❤️'.repeat(state.lives)}</div>
      </div>

      {/* Maze */}
      <div style={{
        position: 'relative',
        width: `${state.maze.size * cellSize}px`,
        height: `${state.maze.size * cellSize}px`
      }}>
        {state.maze.grid?.map((row, y) => (
          row.map((cell, x) => (
            <div key={`${x}-${y}`} style={{
              position: 'absolute',
              left: `${x * cellSize}px`,
              top: `${y * cellSize}px`,
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              backgroundColor: cell === 1 ? '#1A237E' : 'black',
              borderRadius: cell === 1 ? '4px' : '0'
            }}>
              {cell === 2 && (
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '6px',
                  height: '6px',
                  backgroundColor: 'white',
                  borderRadius: '50%'
                }} />
              )}
              {cell === 3 && (
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'white',
                  borderRadius: '50%'
                }} />
              )}
            </div>
          ))
        ))}

        {/* Player */}
        <div style={{
          position: 'absolute',
          left: `${state.player.x * cellSize}px`,
          top: `${state.player.y * cellSize}px`,
          width: `${cellSize}px`,
          height: `${cellSize}px`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'left 0.2s, top 0.2s'
        }}>
          <div style={{
            width: `${cellSize * 0.7}px`,
            height: `${cellSize * 0.7}px`,
            backgroundColor: 'yellow',
            borderRadius: '50%'
          }} />
        </div>

        {/* Ghosts */}
        {state.ghosts?.map((ghost, index) => (
          <div key={index} style={{
            position: 'absolute',
            left: `${ghost.x * cellSize}px`,
            top: `${ghost.y * cellSize}px`,
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'left 0.2s, top 0.2s'
          }}>
            <div style={{
              width: `${cellSize * 0.7}px`,
              height: `${cellSize * 0.7}px`,
              backgroundColor: state.powerMode ? 'blue' : 
                ['red', 'pink', 'cyan', 'orange'][index % 4],
              borderRadius: '50% 50% 0 0'
            }} />
          </div>
        ))}
      </div>

      {/* Game Status Overlays */}
      {state.gameStatus === 'level-complete' && (
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '24px',
          textAlign: 'center'
        }}>
          <div>Level Complete!</div>
          <div style={{ fontSize: '18px', marginTop: '10px' }}>Score: {state.score}</div>
        </div>
      )}

      {state.gameStatus === 'game-over' && (
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '24px',
          textAlign: 'center'
        }}>
          <div>Game Over</div>
          <div style={{ fontSize: '18px', marginTop: '10px' }}>Final Score: {state.score}</div>
        </div>
      )}
    </div>
  );
}
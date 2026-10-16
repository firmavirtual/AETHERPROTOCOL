// tslint:disable
/* eslint-disable */
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Gamepad,
  HelpCircle,
  Play,
  RotateCw,
  Shield,
  Sun,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {getConfig} from './constants';
import {Game, UNIT_CONFIGS} from './Game';
import {AiDifficulty, FactionId, LightingMode, RTSGameState, UnitTypeKey} from './types';
import {formatTime, gameAudio} from './utils';
import BackgroundMusic from './utils/BackgroundMusic';
import {MenuOverlay, Overlay} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

interface CustomWindow extends Window {
  canHandleBackKey?: boolean;
}

export default function App() {
  const {sdk, isReady} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  const [gameState, setGameState] = useState<RTSGameState>({
    status: 'START',
    score: 0,
    level: 1,
    playerFaction: 'terran',
    enemyFaction: 'xeno',
    difficulty: 'normal',
    lightingMode: 'arctic',
    aether: getConfig('startingAether'),
    enemyAether: getConfig('startingAether'),
    playerSupply: 0,
    enemySupply: 0,
    playerTech: 1,
    enemyTech: 1,
    orbitalCharge: 25,
    enemyOrbitalCharge: 0,
    autoAdvance: getConfig('autoAdvanceDefault'),
    selectedUnitIds: [],
    playerBaseHp: getConfig('baseMaxHp'),
    enemyBaseHp: getConfig('baseMaxHp'),
    nodesCapturedByPlayer: 0,
    matchTimer: 0,
    unitsDestroyed: 0,
    unitsLost: 0,
    epicWaveTriggered: false,
  });

  const [gameKey, setGameKey] = useState(0);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Camera State
  const [cameraAngle, setCameraAngle] = useState(0.25 * Math.PI);
  const [cameraZoom, setCameraZoom] = useState(14);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([-40, 0, 0]);
  const [orbitalAiming, setOrbitalAiming] = useState(false);

  // Box Selection
  const [selectionBox, setSelectionBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Minimap Canvas Ref
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const isMinimapDragging = useRef(false);

  // Mouse Screen-Edge and Middle/Right/Left-Drag Camera Panning
  const isDraggingMouseCam = useRef(false);
  const lastMousePos = useRef<{x: number; y: number}>({x: 0, y: 0});
  const currentMouseScreenPos = useRef<{x: number; y: number}>({x: window.innerWidth / 2, y: window.innerHeight / 2});
  const edgePanVelocity = useRef<{x: number; z: number}>({x: 0, z: 0});

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Middle click (button 1), Right click drag while holding space/ctrl, or Alt+Left Click for smooth RTS terrain dragging
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isDraggingMouseCam.current = true;
        lastMousePos.current = {x: e.clientX, y: e.clientY};
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      currentMouseScreenPos.current = {x: e.clientX, y: e.clientY};

      // 1. Mouse Drag Panning (Middle Click or Alt+Drag)
      if (isDraggingMouseCam.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = {x: e.clientX, y: e.clientY};

        const sinA = Math.sin(cameraAngle);
        const cosA = Math.cos(cameraAngle);
        const panSpeed = 0.28;

        // Transform screen delta to dimetric isometric camera orientation
        const worldDx = (-dx * cosA + dy * sinA) * panSpeed;
        const worldDz = (dx * sinA + dy * cosA) * panSpeed;

        setCameraTarget((prev) => [
          Math.max(-100, Math.min(100, prev[0] + worldDx)),
          prev[1],
          Math.max(-55, Math.min(55, prev[2] + worldDz)),
        ]);
        return;
      }

      // 2. Minimap Live Dragging
      if (isMinimapDragging.current && minimapCanvasRef.current) {
        const rect = minimapCanvasRef.current.getBoundingClientRect();
        const mx = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const my = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const wx = (mx / rect.width) * 240 - 120;
        const wz = (my / rect.height) * 140 - 70;
        setCameraTarget([Math.max(-100, Math.min(100, wx)), 0, Math.max(-55, Math.min(55, wz))]);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      isDraggingMouseCam.current = false;
      isMinimapDragging.current = false;
    };

    // Continuous Frame Loop for Ultra-Smooth Edge Scrolling
    let animationFrameId: number;
    let lastTickTime = performance.now();

    const edgePanLoop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTickTime) / 1000);
      lastTickTime = time;

      if (gameState.status === 'PLAYING' && !isDraggingMouseCam.current && !isMinimapDragging.current) {
        const edgeThreshold = 38;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const mx = currentMouseScreenPos.current.x;
        const my = currentMouseScreenPos.current.y;

        let edgeFactorX = 0;
        let edgeFactorZ = 0;

        if (mx < edgeThreshold) {
          edgeFactorX = -Math.min(1, (edgeThreshold - mx) / edgeThreshold);
        } else if (mx > w - edgeThreshold) {
          edgeFactorX = Math.min(1, (mx - (w - edgeThreshold)) / edgeThreshold);
        }

        if (my < edgeThreshold) {
          edgeFactorZ = -Math.min(1, (edgeThreshold - my) / edgeThreshold);
        } else if (my > h - edgeThreshold) {
          edgeFactorZ = Math.min(1, (my - (h - edgeThreshold)) / edgeThreshold);
        }

        if (edgeFactorX !== 0 || edgeFactorZ !== 0) {
          const sinA = Math.sin(cameraAngle);
          const cosA = Math.cos(cameraAngle);
          const maxSpeed = 75; // Units per second

          const targetVx = (edgeFactorX * cosA + edgeFactorZ * sinA) * maxSpeed;
          const targetVz = (-edgeFactorX * sinA + edgeFactorZ * cosA) * maxSpeed;

          // Smooth acceleration
          edgePanVelocity.current.x += (targetVx - edgePanVelocity.current.x) * Math.min(1, dt * 12);
          edgePanVelocity.current.z += (targetVz - edgePanVelocity.current.z) * Math.min(1, dt * 12);

          setCameraTarget((prev) => [
            Math.max(-100, Math.min(100, prev[0] + edgePanVelocity.current.x * dt)),
            prev[1],
            Math.max(-55, Math.min(55, prev[2] + edgePanVelocity.current.z * dt)),
          ]);
        } else {
          // Smooth deceleration / inertia
          edgePanVelocity.current.x *= Math.max(0, 1 - dt * 10);
          edgePanVelocity.current.z *= Math.max(0, 1 - dt * 10);
          if (Math.abs(edgePanVelocity.current.x) > 0.1 || Math.abs(edgePanVelocity.current.z) > 0.1) {
            setCameraTarget((prev) => [
              Math.max(-100, Math.min(100, prev[0] + edgePanVelocity.current.x * dt)),
              prev[1],
              Math.max(-55, Math.min(55, prev[2] + edgePanVelocity.current.z * dt)),
            ]);
          }
        }
      }

      animationFrameId = requestAnimationFrame(edgePanLoop);
    };

    animationFrameId = requestAnimationFrame(edgePanLoop);

    const handleWheel = (e: WheelEvent) => {
      if (gameState.status !== 'PLAYING') return;
      e.preventDefault();
      // Smooth dynamic zoom scaling between 7x (Far tactical view) and 24x (Close micro view)
      const zoomDelta = -e.deltaY * 0.012;
      setCameraZoom((prev) => Math.max(7, Math.min(24, prev + zoomDelta)));
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, {passive: false});

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [cameraAngle, gameState.status]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).canHandleBackKey =
      ['PLAYING', 'PAUSED'].includes(gameState.status);
  }, [gameState.status]);

  usePlaygroundGameLifecycle(gameState, sdk);

  // --- GAME LAUNCH / RESET ---
  const initGame = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      status: 'PLAYING',
      score: 0,
      level: 1,
      aether: getConfig('startingAether'),
      enemyAether: getConfig('startingAether'),
      playerSupply: 0,
      enemySupply: 0,
      playerTech: 1,
      enemyTech: 1,
      orbitalCharge: 20,
      enemyOrbitalCharge: 0,
      playerBaseHp: getConfig('baseMaxHp'),
      enemyBaseHp: getConfig('baseMaxHp'),
      nodesCapturedByPlayer: 0,
      matchTimer: 0,
      unitsDestroyed: 0,
      unitsLost: 0,
      selectedUnitIds: [],
      epicWaveTriggered: false,
    }));
    setCameraTarget([-50, 0, 0]);
    setIsGameMenuOpen(false);
    setIsBriefingOpen(false);
    setOrbitalAiming(false);
    setGameKey((prev) => prev + 1);

    if (sdk) {
      sdk.startGame();
    }
  }, [sdk]);

  // Autoplay support for automated preview screenshots
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // --- PRODUCTION & UPGRADES ---
  const handleProduceUnit = (key: UnitTypeKey) => {
    const def = UNIT_CONFIGS[gameState.playerFaction][key];
    if (gameState.aether < def.cost) {
      gameAudio.playErrorBuzz();
      return;
    }
    if (gameState.playerTech < def.reqTech) {
      gameAudio.playErrorBuzz();
      return;
    }
    if (gameState.playerSupply + def.spawnCount > getConfig('maxSupply')) {
      gameAudio.playErrorBuzz();
      return;
    }

    setGameState((prev) => ({
      ...prev,
      aether: prev.aether - def.cost,
    }));

    (window as any).__RTS_SPAWN_UNIT?.(key);
  };

  const handleUpgradeTech = () => {
    const cost = gameState.playerTech === 1 ? 150 : gameState.playerTech === 2 ? 240 : 0;
    if (gameState.playerTech >= 3 || gameState.aether < cost) {
      gameAudio.playErrorBuzz();
      return;
    }

    setGameState((prev) => ({
      ...prev,
      playerTech: prev.playerTech + 1,
      aether: prev.aether - cost,
    }));
    gameAudio.playLevelUpStinger();
  };

  const handleTriggerEpicWave = () => {
    setGameState((prev) => ({
      ...prev,
      aether: prev.aether + 900,
      enemyAether: prev.enemyAether + 900,
      playerTech: 3,
      enemyTech: 3,
      epicWaveTriggered: true,
    }));
    (window as any).__RTS_TRIGGER_EPIC_WAVE?.();
  };

  const handleOrbitalStrikeClick = () => {
    if (gameState.orbitalCharge < 100) {
      gameAudio.playErrorBuzz();
      return;
    }
    setOrbitalAiming(true);
    gameAudio.playCrispClick();
  };

  const handleOrbitalFired = (x: number, z: number) => {
    setOrbitalAiming(false);
    setGameState((prev) => ({...prev, orbitalCharge: 0}));
  };

  // --- KEYBOARD CONTROLS & CAMERA PANNING ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.status !== 'PLAYING') return;

      if (e.key === 'Escape') {
        if (orbitalAiming) {
          setOrbitalAiming(false);
          return;
        }
        setIsGameMenuOpen((prev) => !prev);
      } else if (e.key === 'q' || e.key === 'Q') {
        handleProduceUnit('striker');
      } else if (e.key === 'w' || e.key === 'W') {
        handleProduceUnit('artillery');
      } else if (e.key === 'e' || e.key === 'E') {
        handleProduceUnit('fighter');
      } else if (e.key === 'r' || e.key === 'R') {
        handleProduceUnit('titan');
      } else if (e.key === 't' || e.key === 'T') {
        handleProduceUnit('cruiser');
      } else if (e.key === 'y' || e.key === 'Y') {
        handleUpgradeTech();
      } else if (e.key === ' ') {
        handleOrbitalStrikeClick();
      } else if (e.key === 'a' || e.key === 'A') {
        // Select all units
        setGameState((prev) => ({...prev, selectedUnitIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}));
        gameAudio.playConfirmSelect();
      } else if (e.key === 's' || e.key === 'S' || e.key === 'F1' || e.key === '1') {
        // Focus Base
        e.preventDefault();
        setCameraTarget([-90, 0, 0]);
        gameAudio.playCrispClick();
      } else if (e.key === 'F2' || e.key === '2') {
        // Focus North Extractor Node
        e.preventDefault();
        setCameraTarget([0, 0, -38]);
        gameAudio.playCrispClick();
      } else if (e.key === 'F3' || e.key === '3') {
        // Focus Center Nexus
        e.preventDefault();
        setCameraTarget([0, 0, 0]);
        gameAudio.playCrispClick();
      } else if (e.key === 'F4' || e.key === '4') {
        // Focus South Extractor Node
        e.preventDefault();
        setCameraTarget([0, 0, 38]);
        gameAudio.playCrispClick();
      } else if (e.key === 'F5' || e.key === '5') {
        // Focus Enemy Base
        e.preventDefault();
        setCameraTarget([90, 0, 0]);
        gameAudio.playCrispClick();
      } else if (e.key === 'ArrowLeft') {
        setCameraTarget((prev) => [Math.max(-100, prev[0] - 12), prev[1], prev[2]]);
      } else if (e.key === 'ArrowRight') {
        setCameraTarget((prev) => [Math.min(100, prev[0] + 12), prev[1], prev[2]]);
      } else if (e.key === 'ArrowUp') {
        setCameraTarget((prev) => [prev[0], prev[1], Math.max(-50, prev[2] - 12)]);
      } else if (e.key === 'ArrowDown') {
        setCameraTarget((prev) => [prev[0], prev[1], Math.min(50, prev[2] + 12)]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, orbitalAiming, gameState.playerTech, gameState.aether, gameState.orbitalCharge]);

  // --- MINIMAP RADAR RENDER LOOP ---
  useEffect(() => {
    if (gameState.status !== 'PLAYING') return;
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear radar background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Grid telemetry lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Map world coords (-120..120 X, -70..70 Z) to minimap (0..w, 0..h)
    const toMapX = (wx: number) => ((wx + 120) / 240) * w;
    const toMapY = (wz: number) => ((wz + 70) / 140) * h;

    // Draw Bases
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(toMapX(-90) - 5, toMapY(0) - 5, 10, 10);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(toMapX(90) - 5, toMapY(0) - 5, 10, 10);

    // Draw Nodes
    const nodeCoords = [
      {x: 0, z: -38},
      {x: 0, z: 0},
      {x: 0, z: 38},
    ];
    nodeCoords.forEach((nc, i) => {
      ctx.strokeStyle = i === 1 ? '#fbbf24' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toMapX(nc.x), toMapY(nc.z), 4, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Camera Frustum Box
    const camX = toMapX(cameraTarget[0]);
    const camZ = toMapY(cameraTarget[2]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camX - 18, camZ - 12, 36, 24);
  }, [gameState.status, cameraTarget, gameState.matchTimer]);

  const handleMinimapPointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const wx = (mx / canvas.width) * 240 - 120;
    const wz = (my / canvas.height) * 140 - 70;

    if (e.button === 2) {
      // Right click -> order units to point
      (window as any).__RTS_ORDER_UNITS?.(wx, wz, null);
    } else {
      // Left click -> teleport / drag camera immediately
      isMinimapDragging.current = true;
      setCameraTarget([Math.max(-100, Math.min(100, wx)), 0, Math.max(-55, Math.min(55, wz))]);
      gameAudio.playCrispClick();
    }
  };

  const isMusicPlaying = ['PLAYING', 'PAUSED'].includes(gameState.status);
  const currentFactionRoster = UNIT_CONFIGS[gameState.playerFaction];

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col bg-zinc-950 text-white font-mono select-none">
      <BackgroundMusic
        url={getConfig('backgroundMusicUrl')}
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
      />

      {/* ========================================================================= */}
      {/* IN-GAME TACTICAL TOP HUD BAR */}
      {/* ========================================================================= */}
      {gameState.status === 'PLAYING' && (
        <div className="w-full bg-slate-950/90 border-b border-cyan-500/30 px-3 py-1.5 flex flex-wrap items-center justify-between z-30 shrink-0 text-xs backdrop-blur-md">
          {/* Left: Faction, Tech Tier, Aether & Supply */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-cyan-300 font-bold tracking-wider">
              <Shield size={14} className="text-cyan-400" />
              <span>{gameState.playerFaction === 'terran' ? 'AEGIS' : 'KRONOS'}</span>
              <span className="text-[10px] px-1 bg-cyan-500/20 text-cyan-300 rounded">
                TEC {gameState.playerTech}
              </span>
            </div>

            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/30 text-purple-300 font-bold">
              <span className="text-sm">💎</span>
              <span>{Math.floor(gameState.aether)}</span>
              <span className="text-[10px] text-purple-400">
                (+{getConfig('baseIncomeRate') + gameState.nodesCapturedByPlayer * getConfig('nodeIncomeBonus')}/s)
              </span>
            </div>

            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
              <span>⚔️</span>
              <span className="font-bold">{gameState.playerSupply}</span>
              <span className="text-slate-500">/{getConfig('maxSupply')}</span>
            </div>
          </div>

          {/* Center: Base HP Comparison & Match Timer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-400 font-bold">AEGIS</span>
              <div className="w-20 md:w-32 h-2 bg-slate-800 rounded-full overflow-hidden border border-cyan-500/30">
                <div
                  className="h-full bg-cyan-400 transition-all duration-200"
                  style={{
                    width: `${Math.max(0, (gameState.playerBaseHp / getConfig('baseMaxHp')) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400">VS</span>
              <div className="w-20 md:w-32 h-2 bg-slate-800 rounded-full overflow-hidden border border-red-500/30">
                <div
                  className="h-full bg-red-500 transition-all duration-200"
                  style={{
                    width: `${Math.max(0, (gameState.enemyBaseHp / getConfig('baseMaxHp')) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-red-400 font-bold">KRONOS</span>
            </div>

            <div className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-mono font-bold">
              ⏱️ {formatTime(gameState.matchTimer)}
            </div>
          </div>

          {/* Right: Quick Action Buttons, Camera Rotators & Game Menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerEpicWave}
              title="Spawn massive Titan & Dreadnought clash in the center"
              className="px-2 py-1 rounded bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-[11px] shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-1 cursor-pointer">
              <Zap size={12} />
              <span>OLEADA ÉPICA</span>
            </button>

            <button
              onClick={() => {
                setGameState((prev) => ({
                  ...prev,
                  lightingMode:
                    prev.lightingMode === 'arctic'
                      ? 'dusk'
                      : prev.lightingMode === 'dusk'
                      ? 'noon'
                      : 'arctic',
                }));
                gameAudio.playCrispClick();
              }}
              title="Toggle Arctic, Dusk, and Noon sun lighting"
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-[11px] flex items-center gap-1 cursor-pointer">
              <Sun size={12} />
              <span className="uppercase">{gameState.lightingMode}</span>
            </button>

            <div className="flex items-center rounded bg-slate-900 border border-slate-700 overflow-hidden">
              <button
                onClick={() => setCameraZoom((prev) => Math.max(7, prev - 2))}
                className="px-2 py-0.5 hover:bg-slate-800 text-slate-300 font-bold text-xs"
                title="Zoom Out">
                -
              </button>
              <button
                onClick={() => setCameraZoom(14)}
                className="px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 hover:bg-slate-800"
                title="Reset Zoom Level">
                {Math.round((cameraZoom / 14) * 100)}%
              </button>
              <button
                onClick={() => setCameraZoom((prev) => Math.min(24, prev + 2))}
                className="px-2 py-0.5 hover:bg-slate-800 text-slate-300 font-bold text-xs"
                title="Zoom In">
                +
              </button>
            </div>

            <div className="flex items-center rounded bg-slate-900 border border-slate-700 overflow-hidden">
              <button
                onClick={() => setCameraAngle((prev) => prev - Math.PI * 0.25)}
                className="p-1 hover:bg-slate-800 text-slate-300"
                title="Rotate Camera Left">
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCameraAngle(0.25 * Math.PI)}
                className="px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 hover:bg-slate-800"
                title="Reset Camera Angle">
                ISO
              </button>
              <button
                onClick={() => setCameraAngle((prev) => prev + Math.PI * 0.25)}
                className="p-1 hover:bg-slate-800 text-slate-300"
                title="Rotate Camera Right">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Reserved Top-Right Game Menu Button */}
            <button
              onClick={() => setIsGameMenuOpen(true)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-black border border-cyan-500/50 text-cyan-300 font-bold text-xs transition-colors cursor-pointer ml-1">
              MENU
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3D WEBGL PLAYGROUND CANVAS */}
      {/* ========================================================================= */}
      <div className="flex-1 w-full min-h-0 relative">
        <Game
          key={gameKey}
          gameState={gameState}
          setGameState={setGameState}
          cameraAngle={cameraAngle}
          cameraZoom={cameraZoom}
          cameraTarget={cameraTarget}
          orbitalAiming={orbitalAiming}
          onOrbitalFired={handleOrbitalFired}
          selectionBox={selectionBox}
          onUnitSelect={(ids) => setGameState((prev) => ({...prev, selectedUnitIds: ids}))}
          onIssueOrder={(x, z, targetId) => {}}
        />

        {/* Aiming Reticle Active Banner */}
        {orbitalAiming && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-950/90 border border-cyan-400 text-cyan-300 px-6 py-2 rounded-full font-bold text-sm tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.8)] animate-pulse pointer-events-none z-20 flex items-center gap-2">
            <Crosshair size={16} />
            <span>ORBITAL LASER TARGETING ONLINE // CLICK GROUND TO DETONATE</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* IN-GAME BOTTOM HUD: RADAR MINIMAP, INSPECTOR & PRODUCTION DECK */}
      {/* ========================================================================= */}
      {gameState.status === 'PLAYING' && (
        <div className="w-full bg-slate-950/95 border-t border-cyan-500/30 p-2 md:p-3 flex flex-wrap items-center justify-between gap-3 z-30 shrink-0 backdrop-blur-md">
          {/* Left: 2D Radar Minimap */}
          <div className="flex items-center gap-2">
            <div className="relative border-2 border-cyan-500/40 rounded-lg overflow-hidden bg-slate-950 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
              <canvas
                ref={minimapCanvasRef}
                width={150}
                height={88}
                onMouseDown={handleMinimapPointerDown}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleMinimapPointerDown(e);
                }}
                className="cursor-crosshair block"
              />
              <div className="absolute top-1 left-1 text-[9px] text-cyan-400 font-bold pointer-events-none bg-black/60 px-1 rounded">
                RADAR
              </div>
            </div>
          </div>

          {/* Center: Tactical Inspector & Auto-Advance */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setGameState((prev) => ({...prev, autoAdvance: !prev.autoAdvance}));
                  gameAudio.playCrispClick();
                }}
                className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                  gameState.autoAdvance
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}>
                AUTO-AVANCE: {gameState.autoAdvance ? 'ACTIVO' : 'MANUAL'}
              </button>

              <button
                onClick={() => {
                  setGameState((prev) => ({...prev, selectedUnitIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}));
                  gameAudio.playConfirmSelect();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold">
                TODO [A]
              </button>

              <button
                onClick={() => {
                  setCameraTarget([-90, 0, 0]);
                  gameAudio.playCrispClick();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold">
                BASE [S]
              </button>
            </div>

            {/* Orbital Superweapon Progress Bar */}
            <div className="flex items-center gap-2 w-full max-w-xs">
              <button
                onClick={handleOrbitalStrikeClick}
                disabled={gameState.orbitalCharge < 100}
                className={`px-3 py-1 rounded-lg font-bold text-xs tracking-wider flex items-center gap-1 transition-all ${
                  gameState.orbitalCharge >= 100
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.8)] cursor-pointer animate-pulse'
                    : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}>
                <Crosshair size={13} />
                <span>RAYO ORBITAL [ESP]</span>
              </button>
              <div className="flex-1 h-2.5 bg-slate-900 rounded-full border border-slate-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-150"
                  style={{width: `${gameState.orbitalCharge}%`}}
                />
              </div>
              <span className="text-[10px] text-cyan-400 font-bold min-w-[32px]">
                {Math.floor(gameState.orbitalCharge)}%
              </span>
            </div>
          </div>

          {/* Right: 7-Button Tactical Production Deck */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
            {/* [Q] Striker Bots */}
            <button
              onClick={() => handleProduceUnit('striker')}
              disabled={gameState.aether < currentFactionRoster.striker.cost}
              className={`p-2 rounded-xl border flex flex-col items-center min-w-[58px] transition-all ${
                gameState.aether >= currentFactionRoster.striker.cost
                  ? 'bg-slate-900 hover:bg-blue-900/60 border-blue-500/50 text-cyan-300 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-950 border-slate-800 text-slate-600 opacity-60'
              }`}>
              <span className="text-[10px] font-bold text-cyan-400">[Q] BOT x3</span>
              <span className="text-xs font-bold">💎 45</span>
            </button>

            {/* [W] Artillery Tanks */}
            <button
              onClick={() => handleProduceUnit('artillery')}
              disabled={gameState.aether < currentFactionRoster.artillery.cost}
              className={`p-2 rounded-xl border flex flex-col items-center min-w-[58px] transition-all ${
                gameState.aether >= currentFactionRoster.artillery.cost
                  ? 'bg-slate-900 hover:bg-blue-900/60 border-blue-500/50 text-cyan-300 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-950 border-slate-800 text-slate-600 opacity-60'
              }`}>
              <span className="text-[10px] font-bold text-cyan-400">[W] ARTIL x2</span>
              <span className="text-xs font-bold">💎 80</span>
            </button>

            {/* [E] Raptor Fighters */}
            <button
              onClick={() => handleProduceUnit('fighter')}
              disabled={gameState.aether < currentFactionRoster.fighter.cost}
              className={`p-2 rounded-xl border flex flex-col items-center min-w-[58px] transition-all ${
                gameState.aether >= currentFactionRoster.fighter.cost
                  ? 'bg-slate-900 hover:bg-blue-900/60 border-blue-500/50 text-cyan-300 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-950 border-slate-800 text-slate-600 opacity-60'
              }`}>
              <span className="text-[10px] font-bold text-cyan-400">[E] CAZA x2</span>
              <span className="text-xs font-bold">💎 95</span>
            </button>

            {/* [R] Titan Atlas (Req. Tech 2) */}
            <button
              onClick={() => handleProduceUnit('titan')}
              disabled={gameState.playerTech < 2 || gameState.aether < currentFactionRoster.titan.cost}
              className={`p-2 rounded-xl border flex flex-col items-center min-w-[58px] transition-all ${
                gameState.playerTech >= 2 && gameState.aether >= currentFactionRoster.titan.cost
                  ? 'bg-slate-900 hover:bg-amber-900/60 border-amber-500/60 text-amber-300 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-950 border-slate-800 text-slate-600 opacity-50'
              }`}>
              <span className="text-[10px] font-bold text-amber-400">[R] TITÁN</span>
              <span className="text-xs font-bold">
                {gameState.playerTech < 2 ? '🔒 TEC 2' : '💎 165'}
              </span>
            </button>

            {/* [T] Aegis Cruiser (Req. Tech 3) */}
            <button
              onClick={() => handleProduceUnit('cruiser')}
              disabled={gameState.playerTech < 3 || gameState.aether < currentFactionRoster.cruiser.cost}
              className={`p-2 rounded-xl border flex flex-col items-center min-w-[58px] transition-all ${
                gameState.playerTech >= 3 && gameState.aether >= currentFactionRoster.cruiser.cost
                  ? 'bg-slate-900 hover:bg-purple-900/60 border-purple-500/60 text-purple-300 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                  : 'bg-slate-950 border-slate-800 text-slate-600 opacity-50'
              }`}>
              <span className="text-[10px] font-bold text-purple-400">[T] CRUCERO</span>
              <span className="text-xs font-bold">
                {gameState.playerTech < 3 ? '🔒 TEC 3' : '💎 250'}
              </span>
            </button>

            {/* [Y] Tech Upgrade Button */}
            <button
              onClick={handleUpgradeTech}
              disabled={gameState.playerTech >= 3}
              className={`p-2 rounded-xl border flex flex-col items-center min-w-[62px] transition-all ${
                gameState.playerTech < 3
                  ? 'bg-gradient-to-b from-cyan-950 to-blue-950 border-cyan-400/60 text-cyan-300 hover:border-cyan-300 cursor-pointer'
                  : 'bg-slate-950 border-slate-800 text-slate-600 opacity-50'
              }`}>
              <span className="text-[10px] font-bold text-cyan-400">[Y] TEC +1</span>
              <span className="text-xs font-bold text-emerald-400">
                {gameState.playerTech === 1 ? '💎 150' : gameState.playerTech === 2 ? '💎 240' : 'MAX'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN MENU MODAL (Battle.net Sci-Fi Orbital Terminal) */}
      {/* ========================================================================= */}
      {gameState.status === 'START' && (
        <div className="fixed inset-0 bg-slate-950 overflow-y-auto touch-auto z-50 flex items-center justify-center p-4">
          {/* Orbital Horizon Glow Art */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/10 via-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-purple-600/10 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-2xl bg-slate-900/95 border-2 border-cyan-500/50 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col relative z-10 backdrop-blur-xl">
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-6">
              <span className="text-xs text-cyan-400 tracking-widest font-bold">
                SYS: ONLINE // SECTOR 07 ARCTIC
              </span>
              <span className="text-xs text-emerald-400 tracking-widest font-bold">
                ENLACE CUÁNTICO ACTIVO
              </span>
            </div>

            {/* Sci-Fi Title Branding */}
            <div className="text-center mb-6">
              <h2 className="text-xs tracking-[0.4em] text-cyan-400 font-bold uppercase mb-1">
                NEXUS PROTOCOL 3D RTS
              </h2>
              <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 tracking-wider font-mono">
                AETHER PROTOCOL
              </h1>
              <div className="flex items-center justify-center gap-3 mt-1 text-xs text-cyan-300 font-bold tracking-[0.25em]">
                <div className="h-px w-12 bg-cyan-500/40" />
                <span>SHATTERED SUN</span>
                <div className="h-px w-12 bg-cyan-500/40" />
              </div>
            </div>

            {/* Skirmish Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
              {/* Faction Choice */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-2 font-bold uppercase tracking-wider">
                  Facción Aliada:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setGameState((prev) => ({...prev, playerFaction: 'terran', enemyFaction: 'xeno'}));
                      gameAudio.playCrispClick();
                    }}
                    className={`py-2 px-3 rounded-lg border font-bold text-center transition-all ${
                      gameState.playerFaction === 'terran'
                        ? 'bg-blue-950 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}>
                    COALICIÓN AEGIS
                    <span className="block text-[9px] font-normal text-cyan-400/80 mt-0.5">
                      Escudos de Energía
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setGameState((prev) => ({...prev, playerFaction: 'xeno', enemyFaction: 'terran'}));
                      gameAudio.playCrispClick();
                    }}
                    className={`py-2 px-3 rounded-lg border font-bold text-center transition-all ${
                      gameState.playerFaction === 'xeno'
                        ? 'bg-red-950 border-red-400 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}>
                    DOMINIO KRONOS
                    <span className="block text-[9px] font-normal text-red-400/80 mt-0.5">
                      Auto-Regeneración
                    </span>
                  </button>
                </div>
              </div>

              {/* AI Difficulty Choice */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-2 font-bold uppercase tracking-wider">
                  Dificultad de la IA:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['easy', 'normal', 'hard'] as AiDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => {
                        setGameState((prev) => ({...prev, difficulty: diff}));
                        gameAudio.playCrispClick();
                      }}
                      className={`py-2 rounded-lg border font-bold text-center uppercase tracking-wider text-[11px] ${
                        gameState.difficulty === diff
                          ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}>
                      {diff === 'easy' ? 'Recluta' : diff === 'normal' ? 'Comandante' : 'Arconte'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch & Briefing Buttons */}
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={initGame}
                autoFocus
                data-testid="start-button"
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-base md:text-lg tracking-widest transition-all transform hover:scale-[1.02] shadow-[0_0_25px_rgba(6,182,212,0.6)] flex items-center justify-center gap-2 cursor-pointer">
                <Play size={20} />
                <span>DESPLEGAR FUERZAS // INICIAR</span>
              </button>

              <button
                onClick={() => setIsBriefingOpen(true)}
                className="py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold text-sm tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <HelpCircle size={18} />
                <span>INFORME TÁCTICO</span>
              </button>
            </div>

            {/* Footer Telemetry */}
            <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
              <span>AETHER ENTERTAINMENT // PROTOCOL 3D RTS</span>
              <span>VERSION 1.4.3 [ALPHA-PROD]</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MISSION BRIEFING / HOW TO PLAY MODAL */}
      {/* ========================================================================= */}
      {isBriefingOpen && (
        <MenuOverlay tone="neutral" zIndex={1001}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl text-left">
            <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-cyan-500/30 pb-2 uppercase tracking-wider flex items-center gap-2">
              <HelpCircle size={20} />
              <span>INFORME DE MANDO TÁCTICO</span>
            </h2>

            <div className="space-y-3 text-xs text-slate-300 font-mono leading-relaxed mb-6">
              <p>
                <strong className="text-cyan-300">1. OBJETIVO PRIMARIO:</strong> Captura los 3 Nodos de
                Aether (Norte, Centro, Sur) para acelerar tus ingresos y el Rayo Orbital. Destruye la
                Fortaleza de Mando enemiga.
              </p>
              <p>
                <strong className="text-cyan-300">2. CONTROLES RTS:</strong> Clic derecho en el terreno
                ordena avanzar/atacar a las tropas. Teclas <strong>Q, W, E, R, T</strong> producen unidades
                desde tu base.
              </p>
              <p>
                <strong className="text-cyan-300">3. ESCALADA TECNOLÓGICA:</strong> Pulsa <strong>[Y]</strong> para
                subir a Nivel 2 y 3, desbloqueando el <strong>Titán Coloso</strong> y el <strong>Crucero de Batalla</strong> con +20% / +40% de daño y vida.
              </p>
              <p>
                <strong className="text-cyan-300">4. SUPERARMA ORBITAL:</strong> Al llegar al 100% de
                carga, pulsa <strong>[ESPACIO]</strong> y haz clic en el mapa para aniquilar escuadrones
                enemigos con un rayo satelital de 900m.
              </p>
            </div>

            <button
              onClick={() => setIsBriefingOpen(false)}
              className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-sm rounded-xl uppercase tracking-wider transition-colors cursor-pointer">
              CERRAR INFORME
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* ========================================================================= */}
      {/* GAME MENU OVERLAY (ESC / MENU BUTTON) */}
      {/* ========================================================================= */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={1000}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center flex flex-col gap-4">
            <h2 className="text-2xl font-black text-cyan-400 uppercase tracking-widest font-mono">
              TERMINAL DE PAUSA
            </h2>

            <button
              onClick={() => setIsGameMenuOpen(false)}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer">
              REANUDAR COMBATE
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const muted = gameAudio.toggleMute();
                  setIsSfxMuted(muted);
                }}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                {isSfxMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>SFX: {isSfxMuted ? 'OFF' : 'ON'}</span>
              </button>

              <button
                onClick={() => setIsMusicMuted((prev) => !prev)}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                {isMusicMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>MÚSICA: {isMusicMuted ? 'OFF' : 'ON'}</span>
              </button>
            </div>

            <button
              onClick={() => setIsBriefingOpen(true)}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold uppercase tracking-wider cursor-pointer">
              CÓMO JUGAR // GUÍA
            </button>

            <button
              onClick={initGame}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-xs font-bold uppercase tracking-wider cursor-pointer">
              REINICIAR ESCARAMUZA
            </button>

            <button
              onClick={() => {
                setIsGameMenuOpen(false);
                setGameState((prev) => ({...prev, status: 'START'}));
              }}
              className="w-full py-2.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-bold uppercase tracking-wider cursor-pointer">
              ABANDONAR A TERMINAL
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* ========================================================================= */}
      {/* VICTORY DEBRIEFING OVERLAY */}
      {/* ========================================================================= */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="VICTORIA TÁCTICA"
          description={`La fortaleza enemiga ha sido completamente aniquilada.\n\nPuntuación Total: ${gameState.score} PTS\nUnidades Destruidas: ${gameState.unitsDestroyed}\nTiempo de Batalla: ${formatTime(gameState.matchTimer)}`}
          actionLabel="NUEVA BATALLA"
          onAction={initGame}
          icon={<RotateCw size={20} />}
          tone="victory"
        />
      )}

      {/* ========================================================================= */}
      {/* DEFEAT DEBRIEFING OVERLAY */}
      {/* ========================================================================= */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="BASE PERDIDA"
          description={`Tu fortaleza de mando ha caído ante las fuerzas rivales.\n\nPuntuación: ${gameState.score} PTS\nBajas Enemigas: ${gameState.unitsDestroyed}\nTiempo de Resistencia: ${formatTime(gameState.matchTimer)}`}
          actionLabel="REINTENTAR MISIÓN"
          onAction={initGame}
          icon={<RotateCw size={20} />}
          tone="danger"
        />
      )}
    </div>
  );
}

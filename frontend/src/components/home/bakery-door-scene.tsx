"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import type { JSX, RefObject } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type DoorDestination = "login" | "signup";
export type ScenePhase = "idle" | "walking" | "greeting" | "celebrating" | "opening" | "complete";

type BakeryDoorSceneProps = {
  destination: DoorDestination | null;
  disabled: boolean;
  onComplete: (destination: DoorDestination) => void;
  onPhaseChange: (phase: ScenePhase, destination: DoorDestination | null) => void;
  onSelect: (destination: DoorDestination) => void;
  reducedMotion: boolean;
};

type VoxelProps = {
  color: string;
  position: [number, number, number];
  scale: [number, number, number];
};

type ChefRig = {
  body: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
  leftArm: RefObject<THREE.Group | null>;
  leftLeg: RefObject<THREE.Group | null>;
  rightArm: RefObject<THREE.Group | null>;
  rightLeg: RefObject<THREE.Group | null>;
  root: RefObject<THREE.Group | null>;
};

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

const smoothStep = (value: number): number => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

function Voxel({ color, position, scale }: VoxelProps): JSX.Element {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

function createDoorLabelTexture(label: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 144;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "rgba(23, 25, 24, 0.94)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = accent;
    context.fillRect(0, 0, 14, canvas.height);
    context.fillStyle = "#ffffff";
    context.font = "700 48px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2 + 7, canvas.height / 2 + 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function DoorLabel({ accent, label }: { accent: string; label: string }): JSX.Element {
  const texture = useMemo(() => createDoorLabelTexture(label, accent), [accent, label]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, 4.45, 0.16]} scale={[2.2, 0.62, 1]}>
      <spriteMaterial map={texture} toneMapped={false} transparent />
    </sprite>
  );
}

type DoorProps = {
  accent: string;
  destination: DoorDestination;
  disabled: boolean;
  label: string;
  onSelect: (destination: DoorDestination) => void;
  panelRef: RefObject<THREE.Group | null>;
  position: [number, number, number];
};

function BakeryDoor({
  accent,
  destination,
  disabled,
  label,
  onSelect,
  panelRef,
  position,
}: DoorProps): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const hingeX = destination === "login" ? -0.92 : 0.92;
  const panelX = destination === "login" ? 0.92 : -0.92;

  useEffect(() => {
    if (!hovered || disabled) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [disabled, hovered]);

  const handlePointerOver = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    if (!disabled) setHovered(true);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    setHovered(false);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (!disabled) onSelect(destination);
  };

  return (
    <group position={position}>
      <Voxel color="#d9dfdc" position={[-1.08, 2.05, -0.18]} scale={[0.22, 2.25, 0.32]} />
      <Voxel color="#d9dfdc" position={[1.08, 2.05, -0.18]} scale={[0.22, 2.25, 0.32]} />
      <Voxel color="#d9dfdc" position={[0, 4.12, -0.18]} scale={[1.3, 0.22, 0.32]} />
      <group position={[hingeX, 0, 0]} ref={panelRef}>
        <mesh
          onClick={handleClick}
          onPointerOut={handlePointerOut}
          onPointerOver={handlePointerOver}
          position={[panelX, 2.02, 0]}
          scale={hovered && !disabled ? [1.9, 3.74, 0.25] : [1.84, 3.66, 0.22]}
        >
          <boxGeometry />
          <meshStandardMaterial
            color={destination === "login" ? "#426777" : "#3c8d76"}
            emissive={hovered && !disabled ? accent : "#000000"}
            emissiveIntensity={hovered && !disabled ? 0.3 : 0}
            roughness={0.58}
          />
        </mesh>
        <mesh
          onClick={handleClick}
          onPointerOut={handlePointerOut}
          onPointerOver={handlePointerOver}
          position={[destination === "login" ? 1.43 : -1.43, 2.02, 0.28]}
        >
          <boxGeometry args={[0.16, 0.16, 0.18]} />
          <meshStandardMaterial color={accent} metalness={0.2} roughness={0.35} />
        </mesh>
      </group>
      <mesh position={[0, 0.12, 0.05]} scale={[2.28, 0.12, 0.85]}>
        <boxGeometry />
        <meshStandardMaterial color="#b9c8c2" roughness={0.82} />
      </mesh>
      <DoorLabel accent={accent} label={label} />
      {hovered && !disabled ? (
        <pointLight color={accent} intensity={3.5} position={[0, 2.3, 1]} distance={5} />
      ) : null}
    </group>
  );
}

function VoxelChef({ rig }: { rig: ChefRig }): JSX.Element {
  return (
    <group ref={rig.root} scale={0.72}>
      <group position={[0, 2.05, 0]} ref={rig.body}>
        <Voxel color="#f7f8f6" position={[0, 0, 0]} scale={[1.38, 1.58, 0.72]} />
        <Voxel color="#d9dfdc" position={[0, -0.1, 0.76]} scale={[0.9, 1.18, 0.08]} />
        <Voxel color="#f2735b" position={[0, 0.76, 0.78]} scale={[0.42, 0.14, 0.1]} />
        {[-0.38, 0, 0.38].map((offset) => (
          <Voxel
            color="#26343d"
            key={offset}
            position={[-0.28, offset, 0.82]}
            scale={[0.1, 0.1, 0.08]}
          />
        ))}
      </group>

      <group position={[0, 3.68, 0]} ref={rig.head}>
        <Voxel color="#c98560" position={[0, 0, 0]} scale={[1.08, 1, 0.86]} />
        <Voxel color="#694330" position={[0, 0.73, -0.05]} scale={[1.12, 0.22, 0.9]} />
        <Voxel color="#24343d" position={[-0.3, 0.14, 0.91]} scale={[0.14, 0.14, 0.08]} />
        <Voxel color="#24343d" position={[0.3, 0.14, 0.91]} scale={[0.14, 0.14, 0.08]} />
        <Voxel color="#e2a27a" position={[0, -0.12, 0.98]} scale={[0.16, 0.18, 0.12]} />
        <Voxel color="#694330" position={[-0.18, -0.42, 0.95]} scale={[0.25, 0.08, 0.08]} />
        <Voxel color="#694330" position={[0.18, -0.42, 0.95]} scale={[0.25, 0.08, 0.08]} />
        <Voxel color="#ffffff" position={[0, 1.03, 0]} scale={[1.35, 0.24, 1.04]} />
        <Voxel color="#ffffff" position={[0, 1.42, 0]} scale={[1.02, 0.58, 0.9]} />
        <Voxel color="#ffffff" position={[-0.36, 1.88, 0]} scale={[0.68, 0.4, 0.72]} />
        <Voxel color="#ffffff" position={[0.38, 1.86, 0]} scale={[0.62, 0.36, 0.68]} />
      </group>

      <group position={[-1.12, 2.7, 0]} ref={rig.leftArm}>
        <Voxel color="#f7f8f6" position={[0, -0.72, 0]} scale={[0.44, 1.24, 0.52]} />
        <Voxel color="#e2a27a" position={[0, -1.48, 0.04]} scale={[0.4, 0.4, 0.42]} />
      </group>
      <group position={[1.12, 2.7, 0]} ref={rig.rightArm}>
        <Voxel color="#f7f8f6" position={[0, -0.72, 0]} scale={[0.44, 1.24, 0.52]} />
        <Voxel color="#e2a27a" position={[0, -1.48, 0.04]} scale={[0.4, 0.4, 0.42]} />
      </group>

      <group position={[-0.5, 0.82, 0]} ref={rig.leftLeg}>
        <Voxel color="#26343d" position={[0, -0.72, 0]} scale={[0.52, 1.24, 0.58]} />
        <Voxel color="#694330" position={[0, -1.45, 0.22]} scale={[0.64, 0.28, 0.88]} />
      </group>
      <group position={[0.5, 0.82, 0]} ref={rig.rightLeg}>
        <Voxel color="#26343d" position={[0, -0.72, 0]} scale={[0.52, 1.24, 0.58]} />
        <Voxel color="#694330" position={[0, -1.45, 0.22]} scale={[0.64, 0.28, 0.88]} />
      </group>
    </group>
  );
}

function PreparationStation({
  spoonRef,
}: {
  spoonRef: RefObject<THREE.Group | null>;
}): JSX.Element {
  return (
    <group position={[0.88, 0, 1.72]}>
      <Voxel color="#9b6746" position={[0, 0.72, 0]} scale={[2.3, 0.22, 1.18]} />
      <Voxel color="#65422f" position={[-1.78, -0.08, 0]} scale={[0.24, 1.28, 0.26]} />
      <Voxel color="#65422f" position={[1.78, -0.08, 0]} scale={[0.24, 1.28, 0.26]} />
      <mesh position={[0.62, 1.08, 0]}>
        <cylinderGeometry args={[0.62, 0.46, 0.45, 8]} />
        <meshStandardMaterial color="#45b894" roughness={0.56} />
      </mesh>
      <Voxel color="#e9c489" position={[-0.86, 1.03, 0]} scale={[0.65, 0.16, 0.56]} />
      <group position={[0.62, 1.35, 0]} ref={spoonRef}>
        <Voxel color="#9baaa4" position={[0, 0.56, 0]} scale={[0.1, 0.82, 0.1]} />
        <Voxel color="#9baaa4" position={[0, -0.12, 0]} scale={[0.28, 0.22, 0.16]} />
      </group>
    </group>
  );
}

function KitchenBackdrop(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 2.4, -1.72]} scale={[9.6, 5.6, 0.16]}>
        <boxGeometry />
        <meshStandardMaterial color="#dcefe8" roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.14, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[19, 11]} />
        <meshStandardMaterial color="#c8d8d2" roughness={0.9} />
      </mesh>
      <Voxel color="#b8d8cc" position={[0, 4.72, -1.5]} scale={[9.5, 0.1, 0.14]} />
      <Voxel color="#f4f6f5" position={[0, 0.2, -1.5]} scale={[9.5, 0.11, 0.14]} />
      <Voxel color="#f4f6f5" position={[0, 2.45, -1.5]} scale={[0.08, 2.2, 0.14]} />
      <group position={[0, 4.95, -1.35]}>
        {[-4.8, -1.6, 1.6, 4.8].map((offset) => (
          <mesh key={offset} position={[offset, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.34, 0.38, 8]} />
            <meshStandardMaterial color="#26343d" roughness={0.46} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

type WorldProps = BakeryDoorSceneProps;

function BakeryWorld({
  destination,
  disabled,
  onComplete,
  onPhaseChange,
  onSelect,
  reducedMotion,
}: WorldProps): JSX.Element {
  const { camera, pointer, size } = useThree();
  const worldRef = useRef<THREE.Group>(null);
  const chefRootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const spoonRef = useRef<THREE.Group>(null);
  const loginDoorRef = useRef<THREE.Group>(null);
  const signupDoorRef = useRef<THREE.Group>(null);
  const activeDestinationRef = useRef<DoorDestination | null>(null);
  const phaseRef = useRef<ScenePhase>("idle");
  const phaseElapsedRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const completeFiredRef = useRef(false);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 2.1, 0));
  const desiredCameraPositionRef = useRef(new THREE.Vector3());
  const desiredCameraTargetRef = useRef(new THREE.Vector3());
  const rig: ChefRig = {
    body: bodyRef,
    head: headRef,
    leftArm: leftArmRef,
    leftLeg: leftLegRef,
    rightArm: rightArmRef,
    rightLeg: rightLegRef,
    root: chefRootRef,
  };

  const isDesktop = size.width >= 1180;
  const isCompactDesktop = size.width >= 900 && size.width < 1180;
  const isTablet = size.width >= 640 && size.width < 900;
  const worldX = isDesktop ? 2.75 : isCompactDesktop ? 2.65 : isTablet ? 1.7 : 0;
  const worldY = isDesktop ? -0.72 : isCompactDesktop ? -1.12 : isTablet ? -1.85 : -2.75;
  const worldScale = isDesktop ? 0.76 : isCompactDesktop ? 0.46 : isTablet ? 0.55 : 0.31;

  useFrame((state) => {
    const chef = chefRootRef.current;
    const body = bodyRef.current;
    const head = headRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;
    const spoon = spoonRef.current;
    const loginDoor = loginDoorRef.current;
    const signupDoor = signupDoorRef.current;
    const world = worldRef.current;

    const frameTime = Date.now();
    const animationDelta =
      lastFrameTimeRef.current === null
        ? 0
        : Math.min((frameTime - lastFrameTimeRef.current) / 1000, 0.033);
    lastFrameTimeRef.current = frameTime;

    if (
      !chef ||
      !body ||
      !head ||
      !leftArm ||
      !rightArm ||
      !leftLeg ||
      !rightLeg ||
      !spoon ||
      !loginDoor ||
      !signupDoor ||
      !world
    ) {
      return;
    }

    world.position.x = THREE.MathUtils.lerp(world.position.x, worldX, 0.08);
    world.position.y = THREE.MathUtils.lerp(world.position.y, worldY, 0.08);
    const nextWorldScale = THREE.MathUtils.lerp(world.scale.x, worldScale, 0.08);
    world.scale.setScalar(nextWorldScale);

    if (destination === null && activeDestinationRef.current !== null) {
      activeDestinationRef.current = null;
      phaseRef.current = "idle";
      phaseElapsedRef.current = 0;
      completeFiredRef.current = false;
      onPhaseChange("idle", null);
    }

    if (destination && activeDestinationRef.current === null) {
      activeDestinationRef.current = destination;
      phaseRef.current = "walking";
      phaseElapsedRef.current = 0;
      completeFiredRef.current = false;
      onPhaseChange("walking", destination);
    }

    const activeDestination = activeDestinationRef.current;
    const phase = phaseRef.current;
    phaseElapsedRef.current += animationDelta;
    const elapsed = phaseElapsedRef.current;
    const transition = (nextPhase: ScenePhase): void => {
      phaseRef.current = nextPhase;
      phaseElapsedRef.current = 0;
      onPhaseChange(nextPhase, activeDestination);
    };

    const idleMotion = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.65);
    const idleBob = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.1) * 0.025;

    if (!activeDestination || phase === "idle") {
      chef.position.set(0, idleBob, 0.72);
      chef.rotation.y = THREE.MathUtils.lerp(chef.rotation.y, pointer.x * 0.08, 0.04);
      body.rotation.z = idleMotion * 0.012;
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, pointer.x * 0.1, 0.05);
      leftArm.rotation.set(-0.12, 0, 0.28 + idleMotion * 0.04);
      rightArm.rotation.set(-0.42 + idleMotion * 0.08, 0, -0.62 + idleMotion * 0.11);
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      spoon.rotation.y += animationDelta * (reducedMotion ? 0 : 3.2);
      loginDoor.rotation.y = THREE.MathUtils.lerp(loginDoor.rotation.y, 0, 0.12);
      signupDoor.rotation.y = THREE.MathUtils.lerp(signupDoor.rotation.y, 0, 0.12);
    } else if (phase === "walking") {
      const walkDuration = reducedMotion ? 0.3 : 2.35;
      const progress = smoothStep(elapsed / walkDuration);
      const side = activeDestination === "login" ? -1 : 1;
      const targetX = side * 3.05;
      const retreatProgress = smoothStep(progress / 0.24);
      const sideProgress = smoothStep((progress - 0.16) / 0.84);
      chef.position.x = targetX * sideProgress;
      chef.position.z = 0.72 + (-0.54 - 0.72) * retreatProgress;
      chef.position.y = reducedMotion ? 0 : Math.abs(Math.sin(progress * Math.PI * 8)) * 0.08;
      chef.rotation.y = THREE.MathUtils.lerp(chef.rotation.y, side * 1.85, 0.09);
      const stride = reducedMotion ? 0 : Math.sin(progress * Math.PI * 8) * 0.72;
      leftLeg.rotation.x = stride;
      rightLeg.rotation.x = -stride;
      leftArm.rotation.x = -stride * 0.7;
      rightArm.rotation.x = stride * 0.7;
      body.rotation.z = side * Math.sin(progress * Math.PI * 8) * 0.025;

      if (progress >= 1) transition(activeDestination === "login" ? "greeting" : "celebrating");
    } else if (phase === "greeting") {
      const greetingDuration = reducedMotion ? 0.25 : 1.45;
      chef.rotation.y = THREE.MathUtils.lerp(chef.rotation.y, 0, 0.12);
      chef.position.y = 0;
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.15);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.15);
      rightArm.rotation.z = -2.38 + Math.sin(elapsed * 9) * 0.2;
      rightArm.rotation.x = -0.25;
      leftArm.rotation.set(0, 0, 0.18);
      head.rotation.z = -0.08;

      if (elapsed >= greetingDuration) transition("opening");
    } else if (phase === "celebrating") {
      const celebrationDuration = reducedMotion ? 0.25 : 1.55;
      chef.rotation.y = THREE.MathUtils.lerp(chef.rotation.y, 0, 0.12);
      chef.position.y = reducedMotion ? 0 : Math.abs(Math.sin(elapsed * 5.2)) * 0.34;
      chef.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 5.2) * 0.08;
      leftArm.rotation.z = 2.35 + Math.sin(elapsed * 7) * 0.18;
      rightArm.rotation.z = -2.35 - Math.sin(elapsed * 7) * 0.18;
      leftLeg.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * 5.2) * 0.2;
      rightLeg.rotation.x = -leftLeg.rotation.x;

      if (elapsed >= celebrationDuration) transition("opening");
    } else if (phase === "opening") {
      const openingDuration = reducedMotion ? 0.28 : 1.15;
      const progress = smoothStep(elapsed / openingDuration);
      const activeDoor = activeDestination === "login" ? loginDoor : signupDoor;
      activeDoor.rotation.y =
        progress * (activeDestination === "login" ? -Math.PI * 0.52 : Math.PI * 0.52);
      chef.position.y = THREE.MathUtils.lerp(chef.position.y, 0, 0.16);
      chef.rotation.z = THREE.MathUtils.lerp(chef.rotation.z, 0, 0.16);

      if (progress >= 1) transition("complete");
    } else if (!completeFiredRef.current) {
      completeFiredRef.current = true;
      onComplete(activeDestination);
    }

    const cameraFollow = activeDestination ? chef.position.x * worldScale * 0.2 : 0;
    desiredCameraPositionRef.current.set(
      cameraFollow,
      activeDestination ? 4.15 : 4.4,
      activeDestination ? 11.3 : 12.2,
    );
    camera.position.lerp(desiredCameraPositionRef.current, activeDestination ? 0.04 : 0.025);
    const cameraTargetY = size.width < 640 ? 0.9 : world.position.y + 2.15 * worldScale;
    desiredCameraTargetRef.current.set(
      activeDestination ? world.position.x + chef.position.x * worldScale * 0.42 : 0,
      cameraTargetY,
      0,
    );
    cameraTargetRef.current.lerp(desiredCameraTargetRef.current, 0.05);
    camera.lookAt(cameraTargetRef.current);
  });

  const showCelebration =
    destination === "signup" &&
    (phaseRef.current === "celebrating" || phaseRef.current === "opening");

  return (
    <>
      <ambientLight intensity={1.2} />
      <hemisphereLight color="#ffffff" groundColor="#91b9aa" intensity={2.2} />
      <directionalLight color="#ffffff" intensity={3.2} position={[4, 8, 8]} />
      <pointLight color="#67d0ad" distance={12} intensity={6} position={[-5, 3, 5]} />
      <pointLight color="#f58a75" distance={10} intensity={4} position={[5, 2, 4]} />

      <group position={[worldX, worldY, 0]} ref={worldRef} scale={worldScale}>
        <KitchenBackdrop />
        <BakeryDoor
          accent="#78cbd7"
          destination="login"
          disabled={disabled}
          label="LOGIN DOOR"
          onSelect={onSelect}
          panelRef={loginDoorRef}
          position={[-3.45, 0, -1.28]}
        />
        <BakeryDoor
          accent="#67d0ad"
          destination="signup"
          disabled={disabled}
          label="SIGN UP DOOR"
          onSelect={onSelect}
          panelRef={signupDoorRef}
          position={[3.45, 0, -1.28]}
        />
        <PreparationStation spoonRef={spoonRef} />
        <VoxelChef rig={rig} />
        <mesh position={[0, -0.1, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[4.8, 32]} />
          <meshBasicMaterial color="#55736a" opacity={0.12} transparent />
        </mesh>
        {showCelebration && !reducedMotion ? (
          <Sparkles
            color="#f2735b"
            count={size.width < 640 ? 44 : 76}
            noise={1.2}
            position={[3.2, 3.2, 0.5]}
            scale={[4.8, 5.2, 3]}
            size={5}
            speed={1.3}
          />
        ) : null}
      </group>
    </>
  );
}

export function BakeryDoorScene(props: BakeryDoorSceneProps): JSX.Element {
  return (
    <Canvas
      aria-label="Interactive Minecraft-style chef choosing between the Login and Sign Up doors"
      camera={{ far: 50, fov: 35, near: 0.1, position: [0, 4.4, 12.2] }}
      className="h-full w-full touch-pan-y"
      dpr={1}
      frameloop="always"
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      role="img"
    >
      <Suspense fallback={null}>
        <BakeryWorld {...props} />
      </Suspense>
    </Canvas>
  );
}

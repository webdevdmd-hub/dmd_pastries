"use client";

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export function BakeryOperationsScene(): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const [interactionLabel, setInteractionLabel] = useState("Drag the chef");
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setIsUnavailable(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xf4f6f5, 0);
    renderer.domElement.className = "h-full w-full cursor-grab touch-pan-y";
    renderer.domElement.setAttribute("aria-label", "Interactive voxel chef cooking at a table");
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf4f6f5, 10, 17);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, 0.25, 9.2);

    const world = new THREE.Group();
    const chef = new THREE.Group();
    world.add(chef);
    scene.add(world);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const material = (color: number, roughness = 0.72): THREE.MeshStandardMaterial => {
      const next = new THREE.MeshStandardMaterial({ color, metalness: 0.02, roughness });
      materials.add(next);
      return next;
    };

    const skin = material(0xc98058);
    const skinLight = material(0xe6a477);
    const white = material(0xf7f8f6, 0.58);
    const clothShadow = material(0xd9dfdc, 0.68);
    const charcoal = material(0x171918, 0.62);
    const mint = material(0x45b894, 0.56);
    const coral = material(0xf2735b, 0.58);
    const timber = material(0x9b6746, 0.74);
    const timberDark = material(0x65422f, 0.78);
    const steel = material(0xaeb8b3, 0.36);
    const dough = material(0xe9c489, 0.82);
    const berry = material(0xb9414d, 0.7);

    const addBox = (
      parent: THREE.Object3D,
      size: [number, number, number],
      position: [number, number, number],
      boxMaterial: THREE.Material,
    ): THREE.Mesh => {
      const geometry = new THREE.BoxGeometry(...size);
      geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, boxMaterial);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };

    // Body and uniform.
    addBox(chef, [1.55, 1.65, 0.72], [0, -0.05, 0], white);
    addBox(chef, [1.02, 1.2, 0.08], [0, -0.2, 0.405], clothShadow);
    addBox(chef, [0.12, 0.12, 0.08], [-0.26, 0.24, 0.43], charcoal);
    addBox(chef, [0.12, 0.12, 0.08], [-0.26, -0.08, 0.43], charcoal);
    addBox(chef, [0.12, 0.12, 0.08], [-0.26, -0.4, 0.43], charcoal);
    addBox(chef, [0.42, 0.18, 0.12], [0, 0.61, 0.42], coral).rotation.z = Math.PI / 4;

    // Head, face, hair, and chef hat.
    addBox(chef, [1.2, 1.08, 0.92], [0, 1.3, 0], skin);
    addBox(chef, [1.24, 0.24, 0.96], [0, 1.78, -0.03], timberDark);
    addBox(chef, [0.16, 0.16, 0.08], [-0.27, 1.43, 0.5], charcoal);
    addBox(chef, [0.16, 0.16, 0.08], [0.27, 1.43, 0.5], charcoal);
    addBox(chef, [0.18, 0.18, 0.14], [0, 1.17, 0.53], skinLight);
    addBox(chef, [0.26, 0.1, 0.08], [-0.17, 0.98, 0.51], timberDark).rotation.z = -0.16;
    addBox(chef, [0.26, 0.1, 0.08], [0.17, 0.98, 0.51], timberDark).rotation.z = 0.16;
    addBox(chef, [1.52, 0.24, 1.08], [0, 1.94, 0], white);
    addBox(chef, [1.12, 0.48, 0.92], [0, 2.28, 0], white);
    addBox(chef, [0.78, 0.38, 0.78], [-0.18, 2.69, 0], white);
    addBox(chef, [0.62, 0.34, 0.7], [0.3, 2.65, 0], white);

    // Legs remain visible below the prep counter.
    addBox(chef, [0.56, 1.05, 0.62], [-0.42, -1.38, -0.02], charcoal);
    addBox(chef, [0.56, 1.05, 0.62], [0.42, -1.38, -0.02], charcoal);
    addBox(chef, [0.68, 0.3, 0.92], [-0.42, -2.0, 0.13], timberDark);
    addBox(chef, [0.68, 0.3, 0.92], [0.42, -2.0, 0.13], timberDark);

    // Arms are separate pivots so cooking motion remains inexpensive.
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.93, 0.55, 0.02);
    leftArm.rotation.z = 0.24;
    chef.add(leftArm);
    addBox(leftArm, [0.46, 1.25, 0.5], [0, -0.57, 0], white);
    addBox(leftArm, [0.42, 0.42, 0.42], [0, -1.28, 0.06], skinLight);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.94, 0.52, 0.04);
    rightArm.rotation.z = -0.55;
    rightArm.rotation.x = -0.18;
    chef.add(rightArm);
    addBox(rightArm, [0.46, 1.28, 0.5], [0, -0.58, 0], white);
    addBox(rightArm, [0.42, 0.42, 0.42], [0, -1.3, 0.08], skinLight);

    // Preparation counter.
    const counter = new THREE.Group();
    counter.position.set(0.25, -1.33, 0.92);
    world.add(counter);
    addBox(counter, [4.5, 0.26, 1.55], [0, 0, 0], timber);
    addBox(counter, [4.22, 0.2, 1.3], [0, -0.24, 0], timberDark);
    addBox(counter, [0.28, 1.25, 0.3], [-1.72, -0.78, -0.38], timberDark);
    addBox(counter, [0.28, 1.25, 0.3], [1.72, -0.78, -0.38], timberDark);

    const bowlGeometry = new THREE.CylinderGeometry(0.64, 0.46, 0.42, 8);
    geometries.add(bowlGeometry);
    const bowl = new THREE.Mesh(bowlGeometry, mint);
    bowl.position.set(0.48, 0.34, 0.08);
    counter.add(bowl);
    addBox(counter, [0.72, 0.12, 0.72], [0.48, 0.57, 0.08], dough);

    const board = addBox(counter, [1.18, 0.1, 0.78], [-1.02, 0.2, 0.12], white);
    board.rotation.y = -0.08;
    addBox(counter, [0.48, 0.22, 0.4], [-1.18, 0.37, 0.12], dough).rotation.y = 0.28;
    addBox(counter, [0.28, 0.2, 0.26], [-0.76, 0.37, 0.18], berry);
    addBox(counter, [0.24, 0.18, 0.22], [-0.47, 0.36, 0], berry);

    // Blocky spoon and stirring pivot over the mixing bowl.
    const stirrer = new THREE.Group();
    stirrer.position.set(0.48, 0.54, 0.08);
    counter.add(stirrer);
    const spoon = addBox(stirrer, [0.12, 1.5, 0.12], [0, 0.62, 0], steel);
    spoon.rotation.z = -0.3;
    addBox(stirrer, [0.34, 0.28, 0.16], [-0.22, -0.08, 0], steel);

    const steamMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      opacity: 0.62,
      roughness: 0.3,
      transparent: true,
    });
    materials.add(steamMaterial);
    const steam: { material: THREE.MeshStandardMaterial; mesh: THREE.Mesh; offset: number }[] = [];
    for (let index = 0; index < 5; index += 1) {
      const puffMaterial = steamMaterial.clone();
      materials.add(puffMaterial);
      const puff = addBox(
        counter,
        [0.12, 0.12, 0.12],
        [0.35 + (index % 2) * 0.22, 0.85 + index * 0.28, 0.08],
        puffMaterial,
      );
      steam.push({ material: puffMaterial, mesh: puff, offset: index * 0.73 });
    }

    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0xbfd7cd,
      opacity: 0.26,
      transparent: true,
    });
    materials.add(floorMaterial);
    const floorGeometry = new THREE.CircleGeometry(2.7, 48);
    geometries.add(floorGeometry);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0.4, -2.22, 0.35);
    floor.scale.set(1.45, 0.42, 1);
    world.add(floor);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfd6cc, 2.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(4, 6, 7);
    scene.add(keyLight);
    const mintLight = new THREE.PointLight(0x55d8ae, 12, 8);
    mintLight.position.set(-3, 0.5, 3);
    scene.add(mintLight);
    const warmLight = new THREE.PointLight(0xff8b72, 10, 7);
    warmLight.position.set(3, -1, 4);
    scene.add(warmLight);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drag = {
      active: false,
      lastX: 0,
      lastY: 0,
      offsetX: 0,
      offsetY: 0,
      rotationX: 0.02,
      rotationY: -0.22,
      targetOffsetX: 0,
      targetOffsetY: 0,
      targetRotationX: 0.02,
      targetRotationY: -0.22,
    };
    let layoutX = 0;
    let layoutY = 0;
    let layoutScale = 1;
    let frameId = 0;

    const setLayout = (): void => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(Math.max(width, 1), Math.max(height, 1), false);
      camera.aspect = Math.max(width, 1) / Math.max(height, 1);
      camera.updateProjectionMatrix();
      const wide = width >= 1024;
      const tablet = width >= 700;
      layoutX = wide ? 2.05 : tablet ? 2.25 : 0.85;
      layoutY = wide ? -0.1 : tablet ? -1.55 : -1.95;
      layoutScale = wide ? 0.88 : tablet ? 0.64 : 0.38;
    };

    const handlePointerDown = (event: PointerEvent): void => {
      drag.active = true;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
      setInteractionLabel("Move and rotate");
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!drag.active) return;
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.targetRotationY += deltaX * 0.012;
      drag.targetRotationX = clamp(drag.targetRotationX + deltaY * 0.006, -0.32, 0.32);
      drag.targetOffsetX = clamp(drag.targetOffsetX + deltaX * 0.002, -0.85, 0.85);
      drag.targetOffsetY = clamp(drag.targetOffsetY - deltaY * 0.002, -0.28, 0.42);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      drag.active = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      renderer.domElement.style.cursor = "grab";
      setInteractionLabel("Drag the chef");
    };

    const animate = (time: number): void => {
      const elapsed = time * 0.001;
      drag.rotationX += (drag.targetRotationX - drag.rotationX) * 0.1;
      drag.rotationY += (drag.targetRotationY - drag.rotationY) * 0.1;
      drag.offsetX += (drag.targetOffsetX - drag.offsetX) * 0.09;
      drag.offsetY += (drag.targetOffsetY - drag.offsetY) * 0.09;

      world.position.x = layoutX + drag.offsetX;
      world.position.y =
        layoutY + drag.offsetY + (reducedMotion ? 0 : Math.sin(elapsed * 0.9) * 0.035);
      world.scale.setScalar(layoutScale);
      world.rotation.x = drag.rotationX;
      world.rotation.y = drag.rotationY;

      if (!reducedMotion) {
        rightArm.rotation.z = -0.55 + Math.sin(elapsed * 3.1) * 0.12;
        rightArm.rotation.x = -0.18 + Math.cos(elapsed * 3.1) * 0.08;
        stirrer.rotation.y = elapsed * 3.1;
        stirrer.rotation.z = Math.sin(elapsed * 3.1) * 0.08;
        chef.rotation.z = Math.sin(elapsed * 0.9) * 0.012;
        steam.forEach(({ material: puffMaterial, mesh: puff, offset }, index) => {
          const cycle = (elapsed * 0.42 + offset) % 2.1;
          puff.position.y = 0.82 + cycle * 0.55;
          puff.position.x = 0.35 + (index % 2) * 0.22 + Math.sin(elapsed + index) * 0.08;
          puffMaterial.opacity = Math.max(0, 0.62 - cycle * 0.24);
        });
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(setLayout);
    resizeObserver.observe(mount);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);
    setLayout();
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((nextMaterial) => nextMaterial.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" ref={mountRef}>
      <div
        aria-live="polite"
        className="pointer-events-none absolute bottom-2 left-5 z-10 flex items-center gap-2 border-l-2 border-[#45b894] bg-white/85 px-3 py-2 text-xs font-semibold text-[#171918] backdrop-blur-md sm:bottom-10 sm:left-auto sm:right-10"
        data-testid="scene-interaction-label"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#45b894]" />
        {isUnavailable ? "Voxel chef preview" : interactionLabel}
      </div>
    </div>
  );
}

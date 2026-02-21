import React, { useState, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// --- 数学与辅助函数 (保持不变) ---
const NS = "http://www.w3.org/2000/svg";
const sqrt3 = Math.sqrt(3);

const pts = (points: number[][]) => points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");
const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (p: number[], q: number[], t: number) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

const equilateralFromBase = (B: number[], C: number[]) => {
    const s = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const h = sqrt3 * s / 2;
    const cx = (B[0] + C[0]) / 2;
    const cy = (B[1] + C[1]) / 2;
    return [cx, cy - h];
};

const centralInvertedTriangle = (A: number[], B: number[], C: number[]) => [mid(A, B), mid(A, C), mid(B, C)];

const shieldPath = (cx: number, cy: number, w: number, h: number, topAngleDeg: number, bottomCurviness: number) => {
    const midY = cy - h * 0.12;
    const leftX = cx - w * 0.46;
    const rightX = cx + w * 0.46;

    const a = rightX - cx;
    const alpha = (Math.max(1, Math.min(179, topAngleDeg)) * Math.PI / 180) / 2;
    let topY = midY - (a / Math.tan(alpha));

    const maxTopY = midY - h * 0.05;
    const minTopY = cy - h * 0.95;
    topY = Math.max(minTopY, Math.min(topY, maxTopY));

    const botY = cy + h * 0.52;

    const P0 = [rightX, midY];
    const P3 = [cx, botY];
    const Q0 = [cx, botY];
    const Q3 = [leftX, midY];

    const L2 = lerpPt(P0, P3, 2 / 3);
    const R1 = lerpPt(Q0, Q3, 1 / 3);

    const C1 = [cx + w * 0.48, cy - h * 0.02];
    const C2_default = [cx + w * 0.22, cy + h * 0.36];
    const D1_default = [cx - w * 0.22, cy + h * 0.36];
    const D2 = [cx - w * 0.48, cy - h * 0.02];

    const t = clamp(bottomCurviness, 0, 2.5);

    const mixOrExtrap = (linePt: number[], defPt: number[], t: number) => {
        if (t <= 1) return lerpPt(linePt, defPt, t);
        const d = [defPt[0] - linePt[0], defPt[1] - linePt[1]];
        return [linePt[0] + d[0] * t, linePt[1] + d[1] * t];
    };

    const C2 = mixOrExtrap(L2, C2_default, t);
    const D1 = mixOrExtrap(R1, D1_default, t);

    return `M ${cx} ${topY} L ${rightX} ${midY} C ${C1[0]} ${C1[1]}, ${C2[0]} ${C2[1]}, ${cx} ${botY} C ${D1[0]} ${D1[1]}, ${D2[0]} ${D2[1]}, ${leftX} ${midY} Z`;
};

// --- 配置参数 ---
const opt = {
    shieldWScale: 0.7,
    shieldHScale: 0.9,
    shieldYOffset: -25,
    shieldTopAngleDeg: 140,
    shieldBottomCurviness: 2.5,
    innerShieldScale: 0.7,
    innerShieldColor: "#ffffff",
    innerShieldYOffset: 10
};

// 动画速度控制器 (在这里修改你的速度需求)
const speedConfig = {
    enterStepDelay: 400,    // 毫秒: 鼠标移入时，展开下一层等待的时间（越小展开越快）
    exitStepDelay: 150,     // 毫秒: 鼠标移走时，收回上一层等待的时间（越小收回越快，建议比展开快）
    enterFadeDuration: 0.8, // 秒: Framer Motion 的透明度渐显时长
    exitFadeDuration: 0.3   // 秒: Framer Motion 的透明度渐隐时长
};

export default function FractalShelterLogo() {
    const [depth, setDepth] = useState(2);
    const [isHovered, setIsHovered] = useState(false);
    const maxDepth = 5;

    // 全局鼠标跟随效果
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springConfig = { damping: 25, stiffness: 100, mass: 0.5 };
    const translateX = useSpring(mouseX, springConfig);
    const translateY = useSpring(mouseY, springConfig);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const xOffset = (e.clientX - window.innerWidth / 2) * 0.04;
            const yOffset = (e.clientY - window.innerHeight / 2) * 0.04;
            mouseX.set(xOffset);
            mouseY.set(yOffset);
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseX, mouseY]);

    // 修改点：全新的按步进展开/收回逻辑
    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (isHovered && depth < maxDepth) {
            // 正在悬停，并且还没长到第 5 层：向上生长
            timer = setTimeout(() => {
                setDepth(prev => prev + 1);
            }, speedConfig.enterStepDelay);
        } else if (!isHovered && depth > 2) {
            // 没有悬停，并且还没退回第 2 层：向下收缩
            timer = setTimeout(() => {
                setDepth(prev => prev - 1);
            }, speedConfig.exitStepDelay);
        }

        // 当深度到达 5 或者 2 时，它会自动停下，不再设置新的 setTimeout
        return () => clearTimeout(timer);
    }, [isHovered, depth]); // 依赖中加入 depth，这样每变一层就会触发下一次判断

    // 预计算节点 (保持不变)
    const { cuts, shields, bigTriangle } = useMemo(() => {
        const W = 1000, H = 900;
        const margin = 80;
        const baseLeft = [margin, H - margin];
        const baseRight = [W - margin, H - margin];
        const A = equilateralFromBase(baseLeft, baseRight);
        const B = baseLeft;
        const C = baseRight;
        const bigT = pts([A, B, C]);

        const allCuts: any[] = [];
        const allShields: any[] = [];
        let cutId = 0; let shieldId = 0;

        const build = (pA: number[], pB: number[], pC: number[], depthLeft: number, level: number) => {
            if (depthLeft <= 0) return;
            const inv = centralInvertedTriangle(pA, pB, pC);

            if (level === 0) {
                const cx = (inv[0][0] + inv[1][0] + inv[2][0]) / 3;
                const cy = (inv[0][1] + inv[1][1] + inv[2][1]) / 3;
                const s = Math.hypot(inv[1][0] - inv[0][0], inv[1][1] - inv[0][1]);

                allCuts.push({
                    id: `cut-shield-${cutId++}`, level,
                    path: shieldPath(cx, cy + opt.shieldYOffset, s * opt.shieldWScale, s * opt.shieldHScale, opt.shieldTopAngleDeg, opt.shieldBottomCurviness)
                });

                allShields.push({
                    id: `inner-shield-${shieldId++}`, level,
                    path: shieldPath(cx, cy + opt.shieldYOffset + opt.innerShieldYOffset, s * opt.shieldWScale * opt.innerShieldScale, s * opt.shieldHScale * opt.innerShieldScale, opt.shieldTopAngleDeg, opt.shieldBottomCurviness)
                });
            } else {
                allCuts.push({ id: `cut-poly-${cutId++}`, level, points: pts(inv) });
            }

            const AB = mid(pA, pB); const AC = mid(pA, pC); const BC = mid(pB, pC);
            build(pA, AB, AC, depthLeft - 1, level + 1);
            build(AB, pB, BC, depthLeft - 1, level + 1);
            build(AC, BC, pC, depthLeft - 1, level + 1);
        };

        build(A, B, C, maxDepth, 0);
        return { cuts: allCuts, shields: allShields, bigTriangle: bigT };
    }, []);

    return (
        <div
            className="w-full h-full flex items-center justify-center relative p-8 cursor-crosshair"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                style={{ x: translateX, y: translateY }}
                className="w-full max-w-[100%] drop-shadow-2xl"
            >
                <svg viewBox="0 0 1000 900" preserveAspectRatio="xMidYMid meet" className="w-full h-auto block">
                    <defs>
                        <mask id="cutMask">
                            <rect x="0" y="0" width="1000" height="900" fill="black" />
                            <polygon points={bigTriangle} fill="white" />

                            {cuts.map((cut) =>
                                cut.path ? (
                                    <motion.path
                                        key={cut.id}
                                        d={cut.path}
                                        fill="black"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: cut.level < depth ? 1 : 0 }}
                                        // 动态切换动画时长
                                        transition={{
                                            duration: isHovered ? speedConfig.enterFadeDuration : speedConfig.exitFadeDuration,
                                            ease: "easeInOut"
                                        }}
                                    />
                                ) : (
                                    <motion.polygon
                                        key={cut.id}
                                        points={cut.points}
                                        fill="black"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: cut.level < depth ? 1 : 0 }}
                                        // 动态切换动画时长
                                        transition={{
                                            duration: isHovered ? speedConfig.enterFadeDuration : speedConfig.exitFadeDuration,
                                            ease: "easeInOut"
                                        }}
                                    />
                                )
                            )}
                        </mask>
                    </defs>

                    <rect x="0" y="0" width="1000" height="900" fill="#ffffff" mask="url(#cutMask)" />

                    {shields.map((shield) => (
                        <motion.path
                            key={shield.id}
                            d={shield.path}
                            fill={opt.innerShieldColor}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: shield.level < depth ? 1 : 0 }}
                            // 动态切换动画时长
                            transition={{
                                duration: isHovered ? speedConfig.enterFadeDuration : speedConfig.exitFadeDuration,
                                ease: "easeInOut"
                            }}
                        />
                    ))}
                </svg>
            </motion.div>
        </div>
    );
}
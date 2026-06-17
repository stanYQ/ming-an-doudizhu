/**
 * ScreenAdapter 安全区 inset 换算逻辑测试。
 * CC 运行时依赖已 mock，只测纯数学换算。
 */

// safeArea 换算函数（从 ScreenAdapter._updateSafeArea 提取）
function calcSafeAreaInset(
    safeRect: { x: number; y: number; width: number; height: number },
    frameSize: { width: number; height: number },
    visibleSize: { width: number; height: number }
) {
    const scaleX = visibleSize.width / frameSize.width;
    const scaleY = visibleSize.height / frameSize.height;
    return {
        top: (frameSize.height - safeRect.y - safeRect.height) * scaleY,
        bottom: safeRect.y * scaleY,
        left: safeRect.x * scaleX,
        right: (frameSize.width - safeRect.x - safeRect.width) * scaleX,
    };
}

describe('ScreenAdapter safeArea inset', () => {
    it('无安全区设备：inset 全 0', () => {
        const result = calcSafeAreaInset(
            { x: 0, y: 0, width: 2532, height: 1170 },
            { width: 2532, height: 1170 },
            { width: 1280, height: 720 }
        );
        expect(result).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    });

    it('iPhone 12（2532×1170）刘海 + Home 条：top/bottom > 0', () => {
        // iOS 实际 safeRect: x=0 y=34 width=2532 height=1084（近似）
        const result = calcSafeAreaInset(
            { x: 0, y: 34, width: 2532, height: 1084 },
            { width: 2532, height: 1170 },
            { width: 1280, height: 720 }
        );
        expect(result.bottom).toBeGreaterThan(0); // Home 条
        expect(result.top).toBeGreaterThan(0);    // 刘海
        expect(result.left).toBe(0);
        expect(result.right).toBe(0);
    });

    it('设计分辨率坐标系换算正确（bottom inset 比例一致）', () => {
        // frame 2x 放大，visible 不变 → inset 应为像素值的一半
        const resultA = calcSafeAreaInset(
            { x: 0, y: 34, width: 1280, height: 686 },
            { width: 1280, height: 720 },
            { width: 1280, height: 720 }
        );
        const resultB = calcSafeAreaInset(
            { x: 0, y: 68, width: 2560, height: 1372 },
            { width: 2560, height: 1440 },
            { width: 1280, height: 720 }
        );
        expect(resultA.bottom).toBeCloseTo(resultB.bottom, 5);
    });
});

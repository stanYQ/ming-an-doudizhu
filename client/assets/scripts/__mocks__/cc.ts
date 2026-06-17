// Minimal Cocos Creator mock for Jest unit tests
export const _decorator = {
  ccclass: () => (target: any) => target,
  property: () => () => {},
  component: () => () => {},
};
export class Component {}
export class Node {
  name = '';
  active = true;
  addComponent(_: any) { return {}; }
  getComponent(_: any) { return null; }
}
export class EventTarget {
  on(_: string, __: Function) {}
  off(_: string, __: Function) {}
  emit(_: string, ...__: any[]) {}
}
export const director = {
  loadScene: jest.fn(),
  getScene: jest.fn(),
};
export const sys = {
  platform: 'UNKNOWN',
  isMobile: false,
};

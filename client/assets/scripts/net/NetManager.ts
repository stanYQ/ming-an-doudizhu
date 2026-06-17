import { Client, Room } from 'colyseus.js';
import { message } from 'db://oops-framework/core/common/event/MessageManager';

export class NetManager {
    private client!: Client;
    private room: Room | null = null;

    init(endpoint: string): void {
        this.client = new Client(endpoint);
    }

    async joinRoom(name: string, options: any): Promise<void> {
        this.room = await this.client.joinOrCreate(name, options);
        this._registerHandlers();
    }

    private _registerHandlers() {
        const r = this.room!;
        r.onMessage('your_hand',       (msg: any) => message.dispatchEvent('HAND',   msg));
        r.onMessage('identity_reveal',  (msg: any) => message.dispatchEvent('REVEAL', msg));
        r.onMessage('game_over',        (msg: any) => message.dispatchEvent('OVER',   msg));
        r.onMessage('turn_change',      (msg: any) => message.dispatchEvent('TURN',   msg));
        r.onMessage('play_broadcast',   (msg: any) => message.dispatchEvent('PLAY',   msg));
        r.onMessage('error',            (msg: any) => message.dispatchEvent('ERROR',  msg));
        r.onStateChange((state: any)              => message.dispatchEvent('STATE',  state));
    }

    playCards(cards: number[]): void {
        this.room?.send('play_cards', { cards });
    }

    pass(): void {
        this.room?.send('pass');
    }

    selectCodeCard(suit: string, value: number): void {
        this.room?.send('select_code_card', { suit, value });
    }

    reconnectSync(): void {
        this.room?.send('reconnect_sync');
    }

    requestHint(): void {
        this.room?.send('request_hint');
    }
}

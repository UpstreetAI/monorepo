import type {
  GenerativeAgentObject,
  PendingActionEventData,
  PendingActionMessage,
} from '../types';
import {
  AbortableMessageEvent,
} from './abortable-message-event';

export class PendingActionEvent extends AbortableMessageEvent<PendingActionEventData> {
  constructor({
    agent,
    message,
  }: {
    agent: GenerativeAgentObject;
    message: PendingActionMessage;
  }) {
    super('pendingaction', {
      data: {
        agent,
        message,
      },
    });
  }
  async commit() {
    const {
      agent: generativeAgent,
      message,
    } = this.data;
    await generativeAgent.addMessage(message);
  }
}
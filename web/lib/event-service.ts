type SSEEvent = {
  type: 'index' | 'search' | 'stats';
  data: any;
};

class EventService {
  private static instance: EventService;
  private clients: Set<(event: SSEEvent) => void> = new Set();

  private constructor() {}

  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  public subscribe(callback: (event: SSEEvent) => void) {
    this.clients.add(callback);
    return () => this.clients.delete(callback);
  }

  public broadcast(event: SSEEvent) {
    this.clients.forEach((callback) => callback(event));
  }
}

export const eventService = EventService.getInstance();

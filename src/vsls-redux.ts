import * as vsls from 'vsls/vscode';
import {
  Store,
  Action,
  Reducer,
  DeepPartial,
  StoreEnhancer,
  StoreCreator,
  applyMiddleware,
  compose,
  Middleware,
} from 'redux';
import { getSharedState } from './sharedState';
import {
  SET_INITIAL_STATE_ACTION_NAME,
  GET_STATE_REQUEST,
  DISPATCH_NOTIFICATION,
  SERVICE_NAME_SUFFIX,
  State,
  ISetInitialStateAction,
} from './constants';

function setInitialState(initialState: State): ISetInitialStateAction {
  return {
    type: SET_INITIAL_STATE_ACTION_NAME,
    initialState,
  };
}

interface VSLSAction extends Action {
  vslsId?: number;
}

interface IInitialState {
  state: State;
  nextActionId: number;
}

type nextFunction = (action: Action) => void;

interface IMiddlewareProvider {
  middleware(): (next: nextFunction) => (action: Action) => any;
}

type VSLSReduxStoreEnhancer = (actionFilter?: (action: Action) => boolean) => (next: StoreCreator) => StoreCreator;

export const vslsStoreEnhancer: VSLSReduxStoreEnhancer = (actionFilter = (action: Action) => true) => (
  next: StoreCreator,
) => (reducer: Reducer, initialStateOrEnhancer?: DeepPartial<any> | StoreEnhancer, enhancer?: StoreEnhancer): Store => {
  const vslsRedux = new VSLSRedux();
  const middlewareEnhancer = applyMiddleware(vslsRedux.createMiddleware(actionFilter));
  let store: Store;
  if (typeof initialStateOrEnhancer === 'object') {
    // DeepPartial<any>
    const composedEnhancer: any = enhancer
      ? compose(
          enhancer,
          middlewareEnhancer,
        )
      : middlewareEnhancer;
    store = next(reducer, <DeepPartial<any>>initialStateOrEnhancer, composedEnhancer);
  } else {
    // StoreEnhancer
    const composedEnhancer: any = initialStateOrEnhancer
      ? compose(
          <StoreEnhancer>initialStateOrEnhancer,
          middlewareEnhancer,
        )
      : middlewareEnhancer;
    store = next(reducer, composedEnhancer);
  }
  vslsRedux.setStore(store);
  return store;
};

class VSLSRedux {
  private remoteService: IMiddlewareProvider | null = null;
  private store: Store | null = null;

  public constructor() {
    this.init();
  }

  private async init() {
    const vslsAPI = await vsls.getApiAsync();
    if (vslsAPI) {
      vslsAPI.onDidChangeSession((e: vsls.SessionChangeEvent) => {
        const isSessionEnded = !e.session.id;

        if (isSessionEnded) {
          this.remoteService = null;
          return;
        }

        switch (e.session.role) {
          case vsls.Role.Guest:
            this.remoteService = new GuestService(this.store);
            break;
          case vsls.Role.Host:
            this.remoteService = new HostService(this.store);
            break;
          default:
            return;
        }
      });
    }
  }

  private defaultActionFilter = (action: Action) => {
    return action.type !== SET_INITIAL_STATE_ACTION_NAME;
  }

  public createMiddleware(actionFilter = (action: Action) => true): Middleware {
    return (): any => {
      return (next: (action: Action) => void) => async (action: Action) => {
        const syncAction = this.defaultActionFilter(action) && actionFilter(action);
        if (syncAction && this.remoteService) {
          this.remoteService.middleware()(next)(action);
        } else {
          next(action);
        }
      };
    };
  }

  public setStore(store: Store) {
    this.store = store;
  }
}

/**
 * The HostService sends the host state to any guests that request it via the getState request
 * and will stamp the vslsId onto any incoming actions and redistribute them to all guests.
 */
class HostService implements IMiddlewareProvider {
  private service: vsls.SharedService | null = null;
  private nextActionId = 0;

  public constructor(store: Store | null) {
    this.init(store);
  }

  private async init(store: Store | null) {
    const vslsAPI = await vsls.getApiAsync();
    if (vslsAPI) {
      // TODO: Namespace this service name by the calling extension's name
      this.service = await vslsAPI.shareService(SERVICE_NAME_SUFFIX);
      if (this.service!.isServiceAvailable) {
        this.service!.onRequest(GET_STATE_REQUEST, (args: any[]) => {
          const initialState: IInitialState = {
            state: getSharedState(),
            nextActionId: this.nextActionId,
          };
          return initialState;
        });
        this.service!.onNotify(DISPATCH_NOTIFICATION, (args: any) => {
          store!.dispatch(args);
        });
      } else {
        // Failed to share service
        // TODO: Handle this
      }
    }
  }

  public middleware = (): any => {
    return (next: nextFunction) => (action: VSLSAction) => {
      action.vslsId = this.nextActionId++;
      next(action);
      this.service!.notify(DISPATCH_NOTIFICATION, action);
    };
  }
}

/**
 * The GuestService requests the intial state from the host, forwards all actions to the host,
 * and dispatches all actions received by the host in order.
 */
class GuestService implements IMiddlewareProvider {
  private serviceProxy: vsls.SharedServiceProxy | null = null;
  private awaitedActions: any = {};
  private nextActionId = 0;
  private store: Store | null;

  public constructor(store: Store | null) {
    this.store = store;
    this.init(store);
  }

  private async init(store: Store | null) {
    const vslsAPI = await vsls.getApiAsync();
    if (vslsAPI) {
      // TODO: Namespace this service name by the calling extension's name
      this.serviceProxy = await vslsAPI.getSharedService(SERVICE_NAME_SUFFIX);
      if (this.serviceProxy!.isServiceAvailable) {
        this.serviceProxy!.onNotify(DISPATCH_NOTIFICATION, (args: any) => {
          store!.dispatch(args);
        });
        this.getInitialState();
      } else {
        // Service not available. Not installed on host?
        // TODO: Handle this
      }
    }
  }

  public async getInitialState(): Promise<any> {
    const initialState: IInitialState = await this.serviceProxy!.request(GET_STATE_REQUEST, []);
    this.nextActionId = initialState.nextActionId;
    this.store!.dispatch(setInitialState(initialState.state));
  }

  public middleware = (): any => {
    return (next: nextFunction) => async (action: VSLSAction) => {
      if (typeof action.vslsId === 'undefined') {
        this.serviceProxy!.notify(DISPATCH_NOTIFICATION, action);
      } else {
        if (action.vslsId !== this.nextActionId) {
          await new Promise((resolve, reject) => {
            this.awaitedActions[action.vslsId || 0] = resolve;
          });
        }
        next(action);
        this.nextActionId++;
        if (this.awaitedActions[this.nextActionId]) {
          this.awaitedActions[this.nextActionId]();
          delete this.awaitedActions[this.nextActionId];
        }
      }
    };
  }
}

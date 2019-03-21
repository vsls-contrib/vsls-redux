# vsls-redux

vsls-redux makes authoring collaborative VS Code extensions simple by providing a thin redux wrapper around the Live Share API. It allows you to specify which piece of your application state you want to synchronize when a guest joins a session and which actions you would like to sync. vsls-redux will then handle syncing the initial state and ensuring that all participants have all synced actions dispatched in the same order. Outside of a Live Share session, your extension will behave like an ordinary redux app.

## Quick Start

To sync all redux actions between all participants in a Live Share session and sync the entire application state when a guest joins the session:

```javascript
import { createStore } from 'redux';
import { shareState, vslsStoreEnhancer } from 'vsls-redux';

const store = createStore(shareState(reducer), <any> vslsStoreEnhancer());
```

## Syncing Actions

To sync redux actions between all participants in a Live Share session, add the `vslsStoreEnhancer` to your store when it's created.

```javascript
import { createStore } from 'redux';
import { vslsStoreEnhancer } from 'vsls-redux';

const store = createStore(reducer, <any> vslsStoreEnhancer());
```

>Note that you must cast the enhancer to `<any>` if using TypeScript because the redux typings are incorrect for store enhancers.

This adds middleware to the redux store that will ensure that all guests receive all synced actions in the same order.

### Specifying which actions to sync

By default, all dispatched actions will be synced. If you want to specify a subset of actions to be synced, you can provide a function to `vslsStoreEnhancer` that takes an `Action` and returns a `boolean`. Only actions that evalute to `true` will be synced.

For example, to only sync actions that have the `syncMe` property set to `true`:

```javascript
import { createStore } from 'redux';
import { vslsStoreEnhancer } from 'vsls-redux';

function shouldSyncAction(action: Action): boolean {
    return action.syncMe;
}

const store = createStore(reducer, <any> vslsStoreEnhancer(shouldSyncAction));
```

## Syncing Initial State

If you want a slice of state for a newly joined guest to match the state of the host when they join the Live Share session, you can specify that the slice of state should be synced by wrapping the reducer responsible for that slice with `shareState`. 

For example, to sync all state:

```javascript
import { createStore } from 'redux';
import { shareState } from 'vsls-redux';

const store = createStore(shareState(reducer));
```

>Note that there is currently a limitation where only one slice of state can be synced.
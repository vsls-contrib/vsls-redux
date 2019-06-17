'use strict';
import * as vscode from 'vscode';
import { createStore, Action } from 'redux';
import { vslsStoreEnhancer, shareState } from 'vsls-redux';

type CounterState = {
    counter: number
};

// Reducer
function counter(state: CounterState = { counter: 0 }, action: Action): CounterState {
    switch (action.type) {
        case 'INCREMENT':
            return {
                counter: state.counter + 1
            };
        case 'DECREMENT':
            return {
                counter: state.counter - 1
            };
        default:
            return state;
    }
}

function updateStatusBar(count: number): void {
    vscode.window.setStatusBarMessage(`Counter: ${count}`);
}

export function activate(context: vscode.ExtensionContext): void {
    activateAsync(context);
}

async function activateAsync(context: vscode.ExtensionContext): Promise<void> {
    const store = createStore<CounterState, Action, undefined, undefined>(shareState(counter), <any> vslsStoreEnhancer());
    store.subscribe(() => {
        updateStatusBar(store.getState().counter);
    });

    let incrementCommand = vscode.commands.registerCommand('vslsreduxcounter.increment', () => {
        store.dispatch({ type: 'INCREMENT' });
    });
    let decrementCommand = vscode.commands.registerCommand('vslsreduxcounter.decrement', () => {
        store.dispatch({ type: 'DECREMENT' });
    });
    let incrementIfOddCommand = vscode.commands.registerCommand('vslsreduxcounter.incrementifodd', () => {
        if (store.getState().counter % 2 !== 0) {
            store.dispatch({ type: 'INCREMENT' });
        }
    });
    let incrementAsyncCommand = vscode.commands.registerCommand('vslsreduxcounter.incrementasync', () => {
        setTimeout(() => {
            store.dispatch({ type: 'INCREMENT' });
        }, 1000);
    });

    context.subscriptions.push(incrementCommand);
    context.subscriptions.push(decrementCommand);
    context.subscriptions.push(incrementIfOddCommand);
    context.subscriptions.push(incrementAsyncCommand);

    updateStatusBar(store.getState().counter);
}

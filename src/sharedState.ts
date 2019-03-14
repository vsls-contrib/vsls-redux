import { Action, Reducer } from 'redux';
import { SET_INITIAL_STATE_ACTION_NAME, State, ISetInitialStateAction } from './constants';

let sharedState: State;

export const shareState: (reducer: Reducer) => Reducer = (reducer: Reducer) => {
  return (state: State, action: Action) => {
    if (action.type === SET_INITIAL_STATE_ACTION_NAME) {
      return (<ISetInitialStateAction>action).initialState;
    }
    sharedState = reducer(state, action);
    return sharedState;
  };
};

export const getSharedState = () => {
  return sharedState;
};

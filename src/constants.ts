import { Action } from 'redux';

export type State = object | undefined;

export interface ISetInitialStateAction extends Action {
  initialState: State;
}

export const SET_INITIAL_STATE_ACTION_NAME = 'vsls-redux.setInitialState';
export const SERVICE_NAME_SUFFIX = 'vsls-redux';
export const GET_STATE_REQUEST = 'getState';
export const DISPATCH_NOTIFICATION = 'dispatch';

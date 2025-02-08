'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import {
    ACTION_HOOK_STATUS,
    ACTION_RESULT_TYPE,
    type ActionHookOutput,
    type ActionHookStatus,
    type HookCallbacks,
    type WrappedServerAction,
} from './types';
import { isError } from './utils';

const defaultErrorMessage = 'Something went wrong';

function getActionStatus<const ActionReturnType>(
    isExecuting: boolean,
    { resultType }: ActionHookOutput<ActionReturnType>,
): ActionHookStatus {
    if (isExecuting) {
        return ACTION_HOOK_STATUS.EXECUTING;
    }

    if (resultType === ACTION_RESULT_TYPE.FETCH_ERROR || resultType === ACTION_RESULT_TYPE.SERVER_ERROR) {
        return ACTION_HOOK_STATUS.ERRORED;
    }

    if (resultType === ACTION_RESULT_TYPE.SUCCESS) {
        return ACTION_HOOK_STATUS.SUCCEEDED;
    }

    return ACTION_HOOK_STATUS.IDLE;
}

function useActionCallbacks<const ActionInput, const ActionReturnType>(
    input: ActionInput,
    actionStatus: ActionHookStatus,
    result: ActionHookOutput<ActionReturnType>,
    setCallbacksStatus?: React.Dispatch<React.SetStateAction<ActionHookStatus>>,
    setCallbacksAreExecuting?: React.Dispatch<React.SetStateAction<boolean>>,
    callbacks?: HookCallbacks<ActionInput, ActionReturnType>,
) {
    useEffect(() => {
        const executeCallbacks = async () => {
            if (actionStatus === ACTION_HOOK_STATUS.SUCCEEDED && result.resultType === ACTION_RESULT_TYPE.SUCCESS) {
                setCallbacksStatus?.(ACTION_HOOK_STATUS.EXECUTING);
                await callbacks?.onSuccess?.(result.data, input);
                await callbacks?.onSettled?.(result.data, null, null, input);
                setCallbacksStatus?.(ACTION_HOOK_STATUS.SUCCEEDED);
                setCallbacksAreExecuting?.(false);
            } else if (
                actionStatus === ACTION_HOOK_STATUS.ERRORED &&
                (result.resultType === ACTION_RESULT_TYPE.SERVER_ERROR ||
                    result.resultType === ACTION_RESULT_TYPE.FETCH_ERROR)
            ) {
                setCallbacksStatus?.(ACTION_HOOK_STATUS.EXECUTING);
                await callbacks?.onError?.(result.error, result.resultType, input);
                await callbacks?.onSettled?.(undefined, result.error, result.resultType, input);
                setCallbacksStatus?.(ACTION_HOOK_STATUS.ERRORED);
                setCallbacksAreExecuting?.(false);
            }
        };

        executeCallbacks().catch(e => {
            setCallbacksStatus?.(ACTION_HOOK_STATUS.ERRORED);
            setCallbacksAreExecuting?.(false);
            // eslint-disable-next-line no-console
            console.error('Callback error: ', e);
        });
    }, [input, result]);
}

const defaultHookResult = {
    resultType: ACTION_HOOK_STATUS.IDLE,
} satisfies ActionHookOutput<unknown>;

export function useAction<const ActionInput, const ActionReturnType>(
    action: WrappedServerAction<ActionInput, ActionReturnType>,
    callbacks?: HookCallbacks<ActionInput, ActionReturnType>,
) {
    const [isTransitioning, startTransition] = useTransition();
    const [result, setResult] = useState<ActionHookOutput<ActionReturnType>>(defaultHookResult);
    const [input, setInput] = useState<ActionInput>();
    const [actionIsExecuting, setActionIsExecuting] = useState(false);
    const [callbacksStatus, setCallbacksStatus] = useState<ActionHookStatus>('idle');
    const [callbacksAreExecuting, setCallbacksAreExecuting] = useState(false);

    const actionStatus = getActionStatus(actionIsExecuting, result);
    const isExecuting = actionIsExecuting || callbacksAreExecuting;

    const reset = useCallback(() => {
        setResult(defaultHookResult);
        setCallbacksStatus(ACTION_HOOK_STATUS.IDLE);
        setInput(undefined);
        setActionIsExecuting(false);
        setCallbacksAreExecuting(false);
    }, []);

    const execute = useCallback(
        (input: ActionInput) => {
            setInput(input);
            setActionIsExecuting(true);

            startTransition(async () => {
                try {
                    const result = await action(input);
                    startTransition(() => {
                        setResult(result ?? defaultHookResult);
                        if (callbacks?.onSuccess !== undefined || callbacks?.onSettled !== undefined) {
                            setCallbacksAreExecuting(true);
                        }
                    });
                } catch (e) {
                    startTransition(() => {
                        setResult({
                            resultType: ACTION_RESULT_TYPE.FETCH_ERROR,
                            error: isError(e) ? e.message : defaultErrorMessage,
                        });
                        if (callbacks?.onError !== undefined || callbacks?.onSettled !== undefined) {
                            setCallbacksAreExecuting(true);
                        }
                    });
                } finally {
                    startTransition(() => {
                        setActionIsExecuting(false);
                    });
                }
            });
        },
        [action],
    );

    const executeAsync = useCallback(
        (input: ActionInput) => {
            const fn = new Promise<Awaited<ReturnType<typeof action>>>((resolve, reject) => {
                setInput(input);
                setActionIsExecuting(true);

                startTransition(async () => {
                    try {
                        const result = await action(input);
                        startTransition(() => {
                            setResult(result ?? defaultHookResult);
                            if (callbacks?.onSuccess !== undefined || callbacks?.onSettled !== undefined) {
                                setCallbacksAreExecuting(true);
                            }
                            resolve(result);
                        });
                    } catch (e) {
                        startTransition(() => {
                            setResult({
                                resultType: ACTION_RESULT_TYPE.FETCH_ERROR,
                                error: isError(e) ? e.message : defaultErrorMessage,
                            });
                            if (callbacks?.onError !== undefined || callbacks?.onSettled !== undefined) {
                                setCallbacksAreExecuting(true);
                            }

                            reject(e instanceof Error ? e : new Error(defaultErrorMessage));
                        });
                    } finally {
                        startTransition(() => {
                            setActionIsExecuting(false);
                        });
                    }
                });
            });

            return fn;
        },
        [action],
    );

    useActionCallbacks(
        input as ActionInput,
        actionStatus,
        result,
        setCallbacksStatus,
        setCallbacksAreExecuting,
        callbacks,
    );

    return {
        /** Calling this will execute the function with the passed parameters */
        execute,
        /** Calling this will execute the function with the passed parameters in a promise and return the result */
        executeAsync,
        /** The result of the action */
        result,
        /** Resets all statuses */
        reset,
        /** The status of the action */
        actionStatus,
        /** The status of the callbacks */
        callbacksStatus,
        /** Whether the action is executing */
        actionIsExecuting,
        /** Whether any of the callbacks are executing */
        callbacksAreExecuting,
        /** Whether the action or any of the callbacks are executing */
        isExecuting,
        /** Whether the underlying React Transition is still going */
        isTransitioning,
    };
}

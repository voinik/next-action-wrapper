'use client';

import { isNotFoundError } from 'next/dist/client/components/not-found';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { useCallback, useEffect, useState } from 'react';

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
        async (input: ActionInput) => {
            setInput(input);
            setActionIsExecuting(true);

            try {
                const result = await action(input);
                setResult(result ?? defaultHookResult);
                if (callbacks?.onSuccess !== undefined || callbacks?.onSettled !== undefined) {
                    setCallbacksAreExecuting(true);
                }
            } catch (e) {
                if (isRedirectError(e) || isNotFoundError(e)) {
                    throw e;
                }

                setResult({
                    resultType: ACTION_RESULT_TYPE.FETCH_ERROR,
                    error: isError(e) ? e.message : defaultErrorMessage,
                });
                if (callbacks?.onError !== undefined || callbacks?.onSettled !== undefined) {
                    setCallbacksAreExecuting(true);
                }
            } finally {
                setActionIsExecuting(false);
            }
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
    };
}

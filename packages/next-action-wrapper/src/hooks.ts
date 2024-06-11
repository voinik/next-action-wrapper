'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    type WrappedServerAction,
    type ActionHookOutput,
    ACTION_HOOK_STATUS,
    type ActionHookStatus,
    ACTION_RESULT_TYPE,
    type HookCallbacks,
} from './types';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { isNotFoundError } from 'next/dist/client/components/not-found';
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
    result: ActionHookOutput<ActionReturnType>,
    callbacks?: HookCallbacks<ActionInput, ActionReturnType>,
) {
    const onSuccessRef = useRef(callbacks?.onSuccess);
    const onErrorRef = useRef(callbacks?.onError);
    const onSettledRef = useRef(callbacks?.onSettled);

    useEffect(() => {
        const onSuccess = onSuccessRef.current;
        const onError = onErrorRef.current;
        const onSettled = onSettledRef.current;

        const executeCallbacks = async () => {
            if (result.resultType === ACTION_RESULT_TYPE.SUCCESS) {
                await onSuccess?.(result.data, input);
                await onSettled?.(result.data, null, null, input);
            } else if (result.resultType === ACTION_RESULT_TYPE.SERVER_ERROR) {
                await onError?.(result.error, result.resultType, input);
                await onSettled?.(undefined, result.error, result.resultType, input);
            } else if (result.resultType === ACTION_RESULT_TYPE.FETCH_ERROR) {
                await onError?.(result.error, result.resultType, input);
                await onSettled?.(undefined, result.error, result.resultType, input);
            }
        };

        executeCallbacks().catch(console.error);
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
    const [isExecuting, setIsExecuting] = useState(false);

    const status = getActionStatus(isExecuting, result);

    const reset = useCallback(() => {
        setResult(defaultHookResult);
    }, []);

    const execute = useCallback(
        async (input: ActionInput) => {
            setInput(input);
            setIsExecuting(true);

            try {
                const result = await action(input);
                setResult(result ?? defaultHookResult);
            } catch (e) {
                if (isRedirectError(e) || isNotFoundError(e)) {
                    throw e;
                }

                setResult({
                    resultType: ACTION_RESULT_TYPE.FETCH_ERROR,
                    error: isError(e) ? e.message : defaultErrorMessage,
                });
            } finally {
                setIsExecuting(false);
            }
        },
        [action],
    );

    useActionCallbacks(input as ActionInput, result, callbacks);

    return {
        execute,
        result,
        reset,
        status,
    };
}

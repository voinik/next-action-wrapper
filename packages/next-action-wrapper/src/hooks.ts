'use client';

import { useCallback, useRef, useState } from 'react';
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

const defaultHookResult = {
    resultType: ACTION_HOOK_STATUS.IDLE,
} satisfies ActionHookOutput<unknown>;

export function useAction<const ActionInput, const ActionReturnType>(
    action: WrappedServerAction<ActionInput, ActionReturnType>,
    callbacks?: HookCallbacks<ActionInput, ActionReturnType>,
) {
    const cb = useRef(callbacks);
    const [result, setResult] = useState<ActionHookOutput<ActionReturnType>>(defaultHookResult);
    const [isExecuting, setIsExecuting] = useState(false);

    const status = getActionStatus(isExecuting, result);

    const reset = useCallback(() => {
        setResult(defaultHookResult);
    }, []);

    const execute = useCallback(
        async (input: ActionInput) => {
            setIsExecuting(true);

            let result: ActionHookOutput<ActionReturnType>;
            try {
                result = await action(input);

                if (result.resultType === ACTION_RESULT_TYPE.SUCCESS) {
                    await cb.current?.onSuccess?.(result.data, input);
                    await cb.current?.onSettled?.(result.data, null, null, input);
                } else if (result.resultType === ACTION_RESULT_TYPE.SERVER_ERROR) {
                    await cb.current?.onError?.(result.error, result.resultType, input);
                    await cb.current?.onSettled?.(undefined, result.error, result.resultType, input);
                }

                setResult(result ?? defaultHookResult);
            } catch (e) {
                const result = {
                    resultType: ACTION_RESULT_TYPE.FETCH_ERROR,
                    error: isError(e) ? e.message : defaultErrorMessage,
                };

                await cb.current?.onError?.(result.error, result.resultType, input);
                await cb.current?.onSettled?.(undefined, result.error, result.resultType, input);

                if (isRedirectError(e) || isNotFoundError(e)) {
                    throw e;
                }

                setResult(result);
            } finally {
                setIsExecuting(false);
            }
        },
        [action],
    );

    return {
        execute,
        result,
        reset,
        status,
    };
}

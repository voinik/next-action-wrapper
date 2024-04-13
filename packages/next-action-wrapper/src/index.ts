import { isNotFoundError } from 'next/dist/client/components/not-found';
import {
    type ActionServerOutput,
    type MaybePromise,
    type ServerAction,
    type WrappedServerAction,
} from './types';
import { DEFAULT_SERVER_ERROR, isError } from './utils';
import { isRedirectError } from 'next/dist/client/components/redirect';

type CreateActionClientOptions = {
    handleServerErrorLogging?: (error: Error) => MaybePromise<void>;
    serverErrorInterceptor?: (error: Error) => MaybePromise<string>;
};

/**
 * Initialize a new action client
 * @param options Options for creating the client
 * @returns {Function} A function that creates a new server action function
 *
 * Based on next-safe-action (https://github.com/TheEdoRan/next-safe-action)
 */
export function createActionClient(options?: CreateActionClientOptions) {
    const handleServerErrorLogging =
        options?.handleServerErrorLogging ??
        (e => {
            console.error('Action error: ', e.message);
        });

    const serverErrorInterceptor = options?.serverErrorInterceptor ?? (() => DEFAULT_SERVER_ERROR);

    function actionBuilder<const ActionInput = void, const ActionReturnType = unknown>(
        serverAction: ServerAction<ActionInput, ActionReturnType>
    ): WrappedServerAction<ActionInput, ActionReturnType> {
        return async function action(actionInput: ActionInput): Promise<ActionServerOutput<ActionReturnType>> {
            try {
                const data = await serverAction(actionInput);
                return { resultType: 'success', data };
            } catch (e) {
                if (isRedirectError(e) || isNotFoundError(e)) {
                    throw e;
                }

                if (!isError(e)) {
                    console.warn('Could not handle server error. Not an instance of Error: ', e);
                    return { resultType: 'serverError', error: DEFAULT_SERVER_ERROR };
                }

                await handleServerErrorLogging(e);

                return { resultType: 'serverError', error: await serverErrorInterceptor(e) };
            }
        };
    }

    return actionBuilder;
}

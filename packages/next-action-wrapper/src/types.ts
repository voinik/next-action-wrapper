export type ObjectValues<T> = T[keyof T];
export type MaybePromise<T> = Promise<T> | T;

export type ServerAction<ActionInput = unknown, ActionReturnType = unknown> = (variables: ActionInput) => Promise<ActionReturnType>;
export type WrappedServerAction<ActionInput = unknown, ActionReturnType = unknown> = (variables: ActionInput) => Promise<ActionServerOutput<ActionReturnType>>;

export const ACTION_RESULT_TYPE = {
    SUCCESS: 'success',
    SERVER_ERROR: 'serverError',
    FETCH_ERROR: 'fetchError',
    IDLE: 'idle',
} as const;

type ActionErrorType = string;

// Server action types

type ActionSuccessfulServerOutput<ActionReturnType> = {
    resultType: typeof ACTION_RESULT_TYPE.SUCCESS;
    data: ActionReturnType;
};

type ActionServerErrorOutput = {
    resultType: typeof ACTION_RESULT_TYPE.SERVER_ERROR;
    error: ActionErrorType;
};

export type ActionServerOutput<ActionReturnType> = ActionSuccessfulServerOutput<ActionReturnType> | ActionServerErrorOutput;


// Hook types

type ActionFetchErrorOutput = {
    resultType: typeof ACTION_RESULT_TYPE.FETCH_ERROR;
    error: ActionErrorType;
};

type ActionIdleOutput = {
    resultType: typeof ACTION_RESULT_TYPE.IDLE;
}

export type ActionHookOutput<ActionReturnType> = ActionServerOutput<ActionReturnType> | ActionFetchErrorOutput | ActionIdleOutput;
type ActionHookErrorOutputs = ActionServerErrorOutput | ActionFetchErrorOutput;

export const ACTION_HOOK_STATUS = {
    IDLE: 'idle',
    EXECUTING: 'executing',
    SUCCEEDED: 'succeeded',
    ERRORED: 'errored',
} as const;

export type ActionHookStatus = ObjectValues<typeof ACTION_HOOK_STATUS>;

export type HookCallbacks<ActionInput, ActionReturnType> = {
	onSuccess?: (data: ActionHookOutput<ActionReturnType>, input: ActionInput) => MaybePromise<void>;
	onError?: (
		error: ActionErrorType,
        errorType: ActionHookErrorOutputs['resultType'],
		input: ActionInput,
	) => MaybePromise<void>;
	onSettled?: (
		result: ActionHookOutput<ActionReturnType> | undefined,
        error: ActionErrorType | null,
        errorType: ActionHookErrorOutputs['resultType'] | null,
		input: ActionInput,
	) => MaybePromise<void>;
};

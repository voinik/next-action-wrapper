// Comes from https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/router-utils/is-postpone.ts

const REACT_POSTPONE_TYPE: symbol = Symbol.for("react.postpone");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPostpone(error: any): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		// eslint-disable-next-line
		error.$$typeof === REACT_POSTPONE_TYPE
	);
}

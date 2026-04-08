// Stub useActor hook — backend interface is currently empty.
// Returns a null actor so all queries/mutations gracefully no-op.
export function useActor() {
  return {
    actor: null as null,
    isFetching: false,
  };
}

const fetchJSON = async <T = unknown>(uri: string): Promise<T> => {
  return await (await fetch(uri)).json();
};

export { fetchJSON };

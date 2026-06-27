import { Redirect } from "expo-router";

const Home = () => {
  return <Redirect href={"/(authenticated)/(tabs)/(home)"} />;
};

export default Home;

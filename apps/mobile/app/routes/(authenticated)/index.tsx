import HomeScreen from "@/screens/home/home";
import { Redirect } from "expo-router";

const Home = () => {
  return <Redirect href={"/(authenticated)/(tabs)/(home)"} />;
};

export default Home;

import LoginScreen from '../components/LoginScreen';

const LoginPage = () => {
  return (
    <div className="h-full w-full bg-black text-white relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] bg-pink-500/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] bg-orange-500/10 blur-[120px] rounded-full" />
      
      <LoginScreen />
    </div>
  );
};

export default LoginPage;

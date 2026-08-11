import { Route, Switch } from "wouter";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SubscriptionSelect from "./pages/SubscriptionSelect";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import Browse from "./pages/listener/Browse";
import Library from "./pages/listener/Library";
import MerchBrowse from "./pages/listener/MerchBrowse";
import Community from "./pages/listener/Community";
import Profile from "./pages/listener/Profile";
import ArtistPublicProfile from "./pages/listener/ArtistPublicProfile";
import ArtistDashboard from "./pages/artist/Dashboard";
import ArtistAnalytics from "./pages/artist/Analytics";
import ArtistMerch from "./pages/artist/MerchStore";
import ArtistCoverArt from "./pages/artist/CoverArt";
import ArtistUpload from "./pages/artist/UploadAudio";
import ArtistReleases from "./pages/artist/Releases";
import ArtistProfile from "./pages/artist/ArtistProfile";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/UsersAdmin";
import AdminModeration from "./pages/admin/Moderation";
import AdminPayouts from "./pages/admin/Payouts";
import AdminSupport from "./pages/admin/Support";
import Support from "./pages/Support";
import { ListenerLayout, ArtistLayout, AdminLayout } from "./components/Layouts";

export default function App() {
  return (
    <Switch>
      {/* public */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/subscription_select" component={SubscriptionSelect} />
      <Route path="/subscription_success" component={SubscriptionSuccess} />
      <Route path="/forgot_password" component={ForgotPassword} />
      <Route path="/reset_password" component={ResetPassword} />
      <Route path="/privacy_policy" component={PrivacyPolicy} />
      <Route path="/terms_conditions" component={TermsConditions} />

      {/* listener (any onboarded user) */}
      <Route path="/browse">
        <ListenerLayout><Browse /></ListenerLayout>
      </Route>
      <Route path="/library">
        <ListenerLayout><Library /></ListenerLayout>
      </Route>
      <Route path="/merch">
        <ListenerLayout><MerchBrowse /></ListenerLayout>
      </Route>
      <Route path="/community">
        <ListenerLayout><Community /></ListenerLayout>
      </Route>
      <Route path="/profile">
        <ListenerLayout><Profile /></ListenerLayout>
      </Route>
      <Route path="/support">
        <ListenerLayout><Support /></ListenerLayout>
      </Route>
      <Route path="/artists/:id">
        {(params) => (
          <ListenerLayout>
            <ArtistPublicProfile id={Number(params.id)} />
          </ListenerLayout>
        )}
      </Route>

      {/* artist */}
      <Route path="/artist">
        <ArtistLayout><ArtistDashboard /></ArtistLayout>
      </Route>
      <Route path="/artist/analytics">
        <ArtistLayout><ArtistAnalytics /></ArtistLayout>
      </Route>
      <Route path="/artist/merch">
        <ArtistLayout><ArtistMerch /></ArtistLayout>
      </Route>
      <Route path="/artist/cover-art">
        <ArtistLayout><ArtistCoverArt /></ArtistLayout>
      </Route>
      <Route path="/artist/upload">
        <ArtistLayout><ArtistUpload /></ArtistLayout>
      </Route>
      <Route path="/artist/releases">
        <ArtistLayout><ArtistReleases /></ArtistLayout>
      </Route>
      <Route path="/artist/profile">
        <ArtistLayout><ArtistProfile /></ArtistLayout>
      </Route>

      {/* admin */}
      <Route path="/admin">
        <AdminLayout><AdminDashboard /></AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout><AdminUsers /></AdminLayout>
      </Route>
      <Route path="/admin/moderation">
        <AdminLayout><AdminModeration /></AdminLayout>
      </Route>
      <Route path="/admin/payouts">
        <AdminLayout><AdminPayouts /></AdminLayout>
      </Route>
      <Route path="/admin/support">
        <AdminLayout><AdminSupport /></AdminLayout>
      </Route>

      <Route>
        <div className="min-h-full flex flex-col items-center justify-center gap-4">
          <h1 className="text-4xl font-bold gradient-text">404</h1>
          <p className="text-txt2">That page doesn't exist.</p>
          <a href="/" className="btn btn-secondary">Back home</a>
        </div>
      </Route>
    </Switch>
  );
}

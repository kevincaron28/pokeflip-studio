package top.kcaron.cardstudio;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.Window;

import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins of this app have to be registered before the bridge starts.
        registerPlugin(AppReviewPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Switching the phone between light and dark does not restart the activity, and Capacitor then
    // re-applies the icon colour it chose at launch. Runs after the plugins, so this one wins.
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean light = (newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES;
        Window window = getWindow();
        window.getDecorView().setBackgroundColor(ContextCompat.getColor(this, R.color.system_bars));
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        // "Light bars" means dark icons on them.
        bars.setAppearanceLightStatusBars(light);
        bars.setAppearanceLightNavigationBars(light);
    }
}

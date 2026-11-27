package top.kcaron.cardstudio;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins of this app have to be registered before the bridge starts.
        registerPlugin(AppReviewPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

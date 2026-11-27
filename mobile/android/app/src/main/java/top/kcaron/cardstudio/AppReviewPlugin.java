package top.kcaron.cardstudio;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Google Play In-App Review. The page asks once, after a first saved alert (app-actions.js).
 * Google decides whether the card is shown and never says whether the person rated.
 */
@CapacitorPlugin(name = "AppReview")
public class AppReviewPlugin extends Plugin {

    @PluginMethod
    public void request(PluginCall call) {
        ReviewManager manager = ReviewManagerFactory.create(getContext());
        manager
            .requestReviewFlow()
            .addOnCompleteListener(request -> {
                if (!request.isSuccessful()) {
                    call.reject("The rating card is not available.");
                    return;
                }
                ReviewInfo info = request.getResult();
                manager
                    .launchReviewFlow(getActivity(), info)
                    .addOnCompleteListener(done -> call.resolve());
            });
    }
}
